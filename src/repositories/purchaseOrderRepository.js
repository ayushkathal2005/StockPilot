const { getPool, sql } = require('../config/database');

class PurchaseOrderRepository {
  /**
   * Generates a unique sequential/timestamped PO number.
   */
  async generatePoNumber() {
    const pool = await getPool();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    return `PO-${dateStr}-${randSuffix}`;
  }

  /**
   * Creates a draft Purchase Order with line items.
   */
  async createPurchaseOrder({ supplierId, createdByUserId, expectedDeliveryDate, items }) {
    const pool = await getPool();
    const transaction = pool.transaction();

    try {
      await transaction.begin();

      // Check supplier exists and is active
      const supReq = transaction.request();
      supReq.input('supplierId', sql.Int, supplierId);
      const supRes = await supReq.query(`SELECT is_active FROM dbo.Suppliers WHERE supplier_id = @supplierId`);
      if (supRes.recordset.length === 0 || !supRes.recordset[0].is_active) {
        const err = new Error('Supplier not found or inactive');
        err.code = 'INVALID_SUPPLIER';
        throw err;
      }

      // Calculate total amount & validate products
      let totalAmount = 0;
      const validatedItems = [];

      for (const item of items) {
        const prodReq = transaction.request();
        prodReq.input('productId', sql.Int, item.productId);
        const prodRes = await prodReq.query(`SELECT product_id, is_active FROM dbo.Products WHERE product_id = @productId`);
        if (prodRes.recordset.length === 0 || !prodRes.recordset[0].is_active) {
          const err = new Error(`Product ${item.productId} not found or inactive`);
          err.code = 'INVALID_PRODUCT';
          throw err;
        }

        const lineCost = Number((item.orderedQuantity * item.unitCost).toFixed(4));
        totalAmount += lineCost;
        validatedItems.push({
          productId: item.productId,
          orderedQuantity: item.orderedQuantity,
          unitCost: item.unitCost
        });
      }

      totalAmount = Number(totalAmount.toFixed(4));
      const poNumber = await this.generatePoNumber();

      // Insert PO header
      const headerReq = transaction.request();
      headerReq.input('poNumber', sql.NVarChar(30), poNumber);
      headerReq.input('supplierId', sql.Int, supplierId);
      headerReq.input('createdByUserId', sql.Int, createdByUserId);
      headerReq.input('expectedDeliveryDate', sql.DateTime2, expectedDeliveryDate ? new Date(expectedDeliveryDate) : null);
      headerReq.input('totalAmount', sql.Decimal(18, 4), totalAmount);

      const headerRes = await headerReq.query(`
        INSERT INTO dbo.PurchaseOrders (
          po_number, supplier_id, created_by_user_id, status, expected_delivery_date, total_amount
        ) OUTPUT INSERTED.po_id, INSERTED.order_date, INSERTED.status
        VALUES (
          @poNumber, @supplierId, @createdByUserId, 'DRAFT', @expectedDeliveryDate, @totalAmount
        )
      `);

      const poId = headerRes.recordset[0].po_id;

      // Insert line items
      for (const vItem of validatedItems) {
        const itemReq = transaction.request();
        itemReq.input('poId', sql.Int, poId);
        itemReq.input('productId', sql.Int, vItem.productId);
        itemReq.input('orderedQuantity', sql.Int, vItem.orderedQuantity);
        itemReq.input('unitCost', sql.Decimal(18, 4), vItem.unitCost);
        await itemReq.query(`
          INSERT INTO dbo.PurchaseOrderItems (
            po_id, product_id, ordered_quantity, received_quantity, unit_cost
          ) VALUES (
            @poId, @productId, @orderedQuantity, 0, @unitCost
          )
        `);
      }

      await transaction.commit();

      return this.getPurchaseOrderById(poId);
    } catch (err) {
      if (transaction._acquiredConnection) {
        await transaction.rollback();
      }
      throw err;
    }
  }

  /**
   * Submits/approves a PO, changing status from DRAFT to SUBMITTED.
   */
  async submitPurchaseOrder(poId, approvedByUserId) {
    const pool = await getPool();
    const request = pool.request();
    request.input('poId', sql.Int, poId);
    request.input('approvedByUserId', sql.Int, approvedByUserId);

    const result = await request.query(`
      UPDATE dbo.PurchaseOrders
      SET status = 'SUBMITTED',
          approved_by_user_id = @approvedByUserId,
          updated_at = SYSUTCDATETIME()
      WHERE po_id = @poId AND status = 'DRAFT'
    `);

    if (result.rowsAffected[0] === 0) {
      const checkRes = await pool.request().input('id', sql.Int, poId).query(`SELECT status FROM dbo.PurchaseOrders WHERE po_id = @id`);
      if (checkRes.recordset.length === 0) {
        const err = new Error('Purchase order not found');
        err.code = 'PO_NOT_FOUND';
        throw err;
      }
      const err = new Error(`Cannot submit purchase order in state: ${checkRes.recordset[0].status}`);
      err.code = 'INVALID_PO_STATE';
      throw err;
    }

    return this.getPurchaseOrderById(poId);
  }

  /**
   * Atomically receives items on a PO, increments inventory, and records stock movements.
   * Supports complete and partial receipts with strict invariant protections.
   */
  async receiveItems({ poId, userId, receipts }) {
    const pool = await getPool();
    const transaction = pool.transaction();

    try {
      await transaction.begin();

      // Lock PO header
      const poReq = transaction.request();
      poReq.input('poId', sql.Int, poId);
      const poRes = await poReq.query(`
        SELECT po_id, po_number, status
        FROM dbo.PurchaseOrders WITH (UPDLOCK, ROWLOCK)
        WHERE po_id = @poId
      `);

      if (poRes.recordset.length === 0) {
        const err = new Error('Purchase order not found');
        err.code = 'PO_NOT_FOUND';
        throw err;
      }

      const po = poRes.recordset[0];
      if (po.status !== 'SUBMITTED' && po.status !== 'PARTIALLY_RECEIVED') {
        const err = new Error(`Cannot receive items for purchase order with status '${po.status}'`);
        err.code = 'INVALID_PO_STATUS';
        throw err;
      }

      // Process each received item
      for (const receipt of receipts) {
        const { poItemId, quantityToReceive } = receipt;

        if (!quantityToReceive || quantityToReceive <= 0) {
          const err = new Error('Quantity to receive must be greater than zero');
          err.code = 'INVALID_RECEIVE_QUANTITY';
          throw err;
        }

        // Lock PO item
        const itemReq = transaction.request();
        itemReq.input('poItemId', sql.Int, poItemId);
        itemReq.input('poId', sql.Int, poId);
        const itemRes = await itemReq.query(`
          SELECT poi.po_item_id, poi.product_id, poi.ordered_quantity, poi.received_quantity
          FROM dbo.PurchaseOrderItems poi WITH (UPDLOCK, ROWLOCK)
          WHERE poi.po_item_id = @poItemId AND poi.po_id = @poId
        `);

        if (itemRes.recordset.length === 0) {
          const err = new Error(`PO item ID ${poItemId} not found on PO #${poId}`);
          err.code = 'PO_ITEM_NOT_FOUND';
          throw err;
        }

        const poItem = itemRes.recordset[0];
        const newReceivedQty = poItem.received_quantity + quantityToReceive;

        if (newReceivedQty > poItem.ordered_quantity) {
          const remaining = poItem.ordered_quantity - poItem.received_quantity;
          const err = new Error(
            `Cannot receive ${quantityToReceive} unit(s). Remaining unreceived: ${remaining}`
          );
          err.code = 'EXCEEDS_ORDERED_QUANTITY';
          err.details = {
            poItemId,
            orderedQuantity: poItem.ordered_quantity,
            alreadyReceived: poItem.received_quantity,
            attemptedReceive: quantityToReceive,
            remainingAllowed: remaining
          };
          throw err;
        }

        // Update PO item received quantity
        const updItemReq = transaction.request();
        updItemReq.input('poItemId', sql.Int, poItemId);
        updItemReq.input('newReceivedQty', sql.Int, newReceivedQty);
        await updItemReq.query(`
          UPDATE dbo.PurchaseOrderItems
          SET received_quantity = @newReceivedQty
          WHERE po_item_id = @poItemId
        `);

        // Lock & increment inventory
        const invReq = transaction.request();
        invReq.input('productId', sql.Int, poItem.product_id);
        invReq.input('addQty', sql.Int, quantityToReceive);
        await invReq.query(`
          UPDATE dbo.Inventory
          SET on_hand_quantity = on_hand_quantity + @addQty,
              updated_at = SYSUTCDATETIME()
          WHERE product_id = @productId
        `);

        // Record stock movement ledger
        const movReq = transaction.request();
        movReq.input('productId', sql.Int, poItem.product_id);
        movReq.input('qty', sql.Int, quantityToReceive);
        movReq.input('poId', sql.Int, poId);
        movReq.input('userId', sql.Int, userId);
        movReq.input('notes', sql.NVarChar(500), `Received ${quantityToReceive} unit(s) from PO #${po.po_number}`);
        await movReq.query(`
          INSERT INTO dbo.StockMovements (
            product_id, movement_type, quantity_delta, reference_type, reference_id, created_by_user_id, notes
          ) VALUES (
            @productId, 'PO_RECEIPT', @qty, 'PURCHASE_ORDER', @poId, @userId, @notes
          )
        `);
      }

      // Check if all items on PO are fully received
      const checkAllReq = transaction.request();
      checkAllReq.input('poId', sql.Int, poId);
      const allItemsRes = await checkAllReq.query(`
        SELECT 
          SUM(ordered_quantity) AS total_ordered,
          SUM(received_quantity) AS total_received
        FROM dbo.PurchaseOrderItems
        WHERE po_id = @poId
      `);

      const totals = allItemsRes.recordset[0];
      const newStatus = (totals.total_received >= totals.total_ordered) ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

      const updPoReq = transaction.request();
      updPoReq.input('poId', sql.Int, poId);
      updPoReq.input('newStatus', sql.NVarChar(25), newStatus);
      await updPoReq.query(`
        UPDATE dbo.PurchaseOrders
        SET status = @newStatus,
            updated_at = SYSUTCDATETIME()
        WHERE po_id = @poId
      `);

      await transaction.commit();

      return this.getPurchaseOrderById(poId);
    } catch (err) {
      if (transaction._acquiredConnection) {
        await transaction.rollback();
      }
      throw err;
    }
  }

  /**
   * Cancels a PO if in DRAFT or SUBMITTED state (with no receipts).
   */
  async cancelPurchaseOrder(poId, userId) {
    const pool = await getPool();
    const transaction = pool.transaction();

    try {
      await transaction.begin();

      const checkReq = transaction.request();
      checkReq.input('poId', sql.Int, poId);
      const checkRes = await checkReq.query(`
        SELECT po_id, status
        FROM dbo.PurchaseOrders WITH (UPDLOCK, ROWLOCK)
        WHERE po_id = @poId
      `);

      if (checkRes.recordset.length === 0) {
        const err = new Error('Purchase order not found');
        err.code = 'PO_NOT_FOUND';
        throw err;
      }

      const po = checkRes.recordset[0];
      if (po.status !== 'DRAFT' && po.status !== 'SUBMITTED') {
        const err = new Error(`Cannot cancel purchase order in '${po.status}' state`);
        err.code = 'CANNOT_CANCEL_PO';
        throw err;
      }

      // Check if any receipts occurred
      const recReq = transaction.request();
      recReq.input('poId', sql.Int, poId);
      const recRes = await recReq.query(`
        SELECT SUM(received_quantity) AS total_received 
        FROM dbo.PurchaseOrderItems 
        WHERE po_id = @poId
      `);

      if (recRes.recordset[0].total_received > 0) {
        const err = new Error('Cannot cancel purchase order with received items');
        err.code = 'CANNOT_CANCEL_PARTIAL_PO';
        throw err;
      }

      const updReq = transaction.request();
      updReq.input('poId', sql.Int, poId);
      await updReq.query(`
        UPDATE dbo.PurchaseOrders
        SET status = 'CANCELLED',
            updated_at = SYSUTCDATETIME()
        WHERE po_id = @poId
      `);

      await transaction.commit();
      return this.getPurchaseOrderById(poId);
    } catch (err) {
      if (transaction._acquiredConnection) {
        await transaction.rollback();
      }
      throw err;
    }
  }

  /**
   * Retrieves paginated Purchase Orders with filtering.
   */
  async getPurchaseOrders({ limit = 50, offset = 0, status, supplierId } = {}) {
    const pool = await getPool();
    const request = pool.request();

    let query = `
      SELECT 
        po.po_id,
        po.po_number,
        po.supplier_id,
        s.supplier_name,
        po.created_by_user_id,
        u_create.full_name AS created_by_name,
        po.approved_by_user_id,
        u_appr.full_name AS approved_by_name,
        po.status,
        po.order_date,
        po.expected_delivery_date,
        po.total_amount,
        po.created_at,
        po.updated_at,
        COUNT(poi.po_item_id) AS item_count,
        SUM(poi.ordered_quantity) AS total_ordered_qty,
        SUM(poi.received_quantity) AS total_received_qty
      FROM dbo.PurchaseOrders po
      INNER JOIN dbo.Suppliers s ON po.supplier_id = s.supplier_id
      INNER JOIN dbo.Users u_create ON po.created_by_user_id = u_create.user_id
      LEFT JOIN dbo.Users u_appr ON po.approved_by_user_id = u_appr.user_id
      LEFT JOIN dbo.PurchaseOrderItems poi ON po.po_id = poi.po_id
      WHERE 1=1
    `;

    if (status) {
      request.input('status', sql.NVarChar(25), status);
      query += ` AND po.status = @status`;
    }

    if (supplierId) {
      request.input('supplierId', sql.Int, supplierId);
      query += ` AND po.supplier_id = @supplierId`;
    }

    query += `
      GROUP BY 
        po.po_id, po.po_number, po.supplier_id, s.supplier_name,
        po.created_by_user_id, u_create.full_name, po.approved_by_user_id, u_appr.full_name,
        po.status, po.order_date, po.expected_delivery_date, po.total_amount,
        po.created_at, po.updated_at
      ORDER BY po.order_date DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    request.input('limit', sql.Int, Math.min(Math.max(limit, 1), 200));
    request.input('offset', sql.Int, Math.max(offset, 0));

    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Retrieves single PO with all items and received statuses.
   */
  async getPurchaseOrderById(poId) {
    const pool = await getPool();
    const request = pool.request();
    request.input('poId', sql.Int, poId);

    const headerRes = await request.query(`
      SELECT 
        po.po_id,
        po.po_number,
        po.supplier_id,
        s.supplier_name,
        s.contact_email AS supplier_email,
        s.contact_phone AS supplier_phone,
        po.created_by_user_id,
        u_create.full_name AS created_by_name,
        po.approved_by_user_id,
        u_appr.full_name AS approved_by_name,
        po.status,
        po.order_date,
        po.expected_delivery_date,
        po.total_amount,
        po.created_at,
        po.updated_at
      FROM dbo.PurchaseOrders po
      INNER JOIN dbo.Suppliers s ON po.supplier_id = s.supplier_id
      INNER JOIN dbo.Users u_create ON po.created_by_user_id = u_create.user_id
      LEFT JOIN dbo.Users u_appr ON po.approved_by_user_id = u_appr.user_id
      WHERE po.po_id = @poId
    `);

    if (headerRes.recordset.length === 0) {
      return null;
    }

    const po = headerRes.recordset[0];

    const itemsRes = await request.query(`
      SELECT 
        poi.po_item_id,
        poi.product_id,
        p.sku,
        p.product_name,
        poi.ordered_quantity,
        poi.received_quantity,
        (poi.ordered_quantity - poi.received_quantity) AS remaining_quantity,
        poi.unit_cost,
        (poi.ordered_quantity * poi.unit_cost) AS line_total
      FROM dbo.PurchaseOrderItems poi
      INNER JOIN dbo.Products p ON poi.product_id = p.product_id
      WHERE poi.po_id = @poId
      ORDER BY poi.po_item_id ASC
    `);

    po.items = itemsRes.recordset;
    return po;
  }
}

module.exports = new PurchaseOrderRepository();
