const { getPool, sql } = require('../config/database');

class SalesRepository {
  /**
   * Atomically records a sale transaction, deducts inventory, and writes stock movements.
   * Uses UPDLOCK/ROWLOCK and sort-by-productId to prevent deadlocks and overselling.
   */
  async createSale({ userId, items, taxRate = 0.05 }) {
    const pool = await getPool();
    const transaction = pool.transaction();

    try {
      await transaction.begin();

      // Sort items by productId ascending to ensure consistent lock acquisition order
      const sortedItems = [...items].sort((a, b) => a.productId - b.productId);

      let subtotalAmount = 0;
      const validatedItems = [];

      for (const item of sortedItems) {
        // Query product details and lock inventory row atomically
        const prodReq = transaction.request();
        prodReq.input('productId', sql.Int, item.productId);
        const prodRes = await prodReq.query(`
          SELECT 
            p.product_id,
            p.sku,
            p.product_name,
            p.cost_price,
            p.selling_price,
            p.is_active,
            i.on_hand_quantity,
            i.reserved_quantity,
            (i.on_hand_quantity - i.reserved_quantity) AS available_quantity
          FROM dbo.Products p WITH (UPDLOCK, ROWLOCK)
          INNER JOIN dbo.Inventory i WITH (UPDLOCK, ROWLOCK) ON p.product_id = i.product_id
          WHERE p.product_id = @productId
        `);

        if (prodRes.recordset.length === 0) {
          const err = new Error(`Product ID ${item.productId} not found`);
          err.code = 'PRODUCT_NOT_FOUND';
          throw err;
        }

        const product = prodRes.recordset[0];

        if (!product.is_active) {
          const err = new Error(`Product ${product.sku} (${product.product_name}) is inactive`);
          err.code = 'PRODUCT_INACTIVE';
          throw err;
        }

        if (product.available_quantity < item.quantity) {
          const err = new Error(
            `Insufficient stock for SKU ${product.sku}. Available: ${product.available_quantity}, Requested: ${item.quantity}`
          );
          err.code = 'INSUFFICIENT_STOCK';
          err.details = {
            productId: product.product_id,
            sku: product.sku,
            availableQuantity: product.available_quantity,
            requestedQuantity: item.quantity
          };
          throw err;
        }

        const lineSubtotal = Number((product.selling_price * item.quantity).toFixed(4));
        subtotalAmount += lineSubtotal;

        validatedItems.push({
          productId: product.product_id,
          sku: product.sku,
          productName: product.product_name,
          quantity: item.quantity,
          unitSellingPrice: product.selling_price,
          unitCostAtSale: product.cost_price,
          subtotal: lineSubtotal,
          newOnHand: product.on_hand_quantity - item.quantity
        });
      }

      subtotalAmount = Number(subtotalAmount.toFixed(4));
      const taxAmount = Number((subtotalAmount * taxRate).toFixed(4));
      const totalAmount = Number((subtotalAmount + taxAmount).toFixed(4));

      // 1. Insert Sales Header
      const saleReq = transaction.request();
      saleReq.input('userId', sql.Int, userId);
      saleReq.input('subtotalAmount', sql.Decimal(18, 4), subtotalAmount);
      saleReq.input('taxAmount', sql.Decimal(18, 4), taxAmount);
      saleReq.input('totalAmount', sql.Decimal(18, 4), totalAmount);
      
      const saleRes = await saleReq.query(`
        INSERT INTO dbo.Sales (
          user_id, sale_date, subtotal_amount, tax_amount, total_amount, status
        ) OUTPUT INSERTED.sale_id, INSERTED.sale_date, INSERTED.status
        VALUES (
          @userId, SYSUTCDATETIME(), @subtotalAmount, @taxAmount, @totalAmount, 'COMPLETED'
        )
      `);

      const sale = saleRes.recordset[0];
      const saleId = sale.sale_id;

      // 2. Insert SaleItems, update Inventory, and record StockMovements
      for (const valItem of validatedItems) {
        // Insert line item
        const itemReq = transaction.request();
        itemReq.input('saleId', sql.Int, saleId);
        itemReq.input('productId', sql.Int, valItem.productId);
        itemReq.input('quantity', sql.Int, valItem.quantity);
        itemReq.input('unitSellingPrice', sql.Decimal(18, 4), valItem.unitSellingPrice);
        itemReq.input('unitCostAtSale', sql.Decimal(18, 4), valItem.unitCostAtSale);
        itemReq.input('subtotal', sql.Decimal(18, 4), valItem.subtotal);
        await itemReq.query(`
          INSERT INTO dbo.SaleItems (
            sale_id, product_id, quantity, unit_selling_price, unit_cost_at_sale, subtotal
          ) VALUES (
            @saleId, @productId, @quantity, @unitSellingPrice, @unitCostAtSale, @subtotal
          )
        `);

        // Deduct inventory
        const invReq = transaction.request();
        invReq.input('productId', sql.Int, valItem.productId);
        invReq.input('newOnHand', sql.Int, valItem.newOnHand);
        await invReq.query(`
          UPDATE dbo.Inventory
          SET on_hand_quantity = @newOnHand,
              updated_at = SYSUTCDATETIME()
          WHERE product_id = @productId
        `);

        // Add movement ledger entry
        const movReq = transaction.request();
        movReq.input('productId', sql.Int, valItem.productId);
        movReq.input('quantityDelta', sql.Int, -valItem.quantity);
        movReq.input('saleId', sql.Int, saleId);
        movReq.input('userId', sql.Int, userId);
        movReq.input('notes', sql.NVarChar(500), `Sale #${saleId}: sold ${valItem.quantity} unit(s)`);
        await movReq.query(`
          INSERT INTO dbo.StockMovements (
            product_id, movement_type, quantity_delta, reference_type, reference_id, created_by_user_id, notes
          ) VALUES (
            @productId, 'SALE', @quantityDelta, 'SALE', @saleId, @userId, @notes
          )
        `);
      }

      await transaction.commit();

      return {
        saleId,
        saleDate: sale.sale_date,
        userId,
        subtotalAmount,
        taxAmount,
        totalAmount,
        status: sale.status,
        items: validatedItems.map(i => ({
          productId: i.productId,
          sku: i.sku,
          productName: i.productName,
          quantity: i.quantity,
          unitSellingPrice: i.unitSellingPrice,
          unitCostAtSale: i.unitCostAtSale,
          subtotal: i.subtotal
        }))
      };
    } catch (err) {
      if (transaction._acquiredConnection) {
        await transaction.rollback();
      }
      throw err;
    }
  }

  /**
   * Retrieves paginated sales history with summary info.
   */
  async getSales({ limit = 50, offset = 0, startDate, endDate, userId } = {}) {
    const pool = await getPool();
    const request = pool.request();

    let query = `
      SELECT 
        s.sale_id,
        s.sale_date,
        s.user_id,
        u.full_name AS cashier_name,
        s.subtotal_amount,
        s.tax_amount,
        s.total_amount,
        s.status,
        COUNT(si.sale_item_id) AS item_count,
        SUM(si.quantity) AS total_units_sold,
        SUM((si.unit_selling_price - si.unit_cost_at_sale) * si.quantity) AS estimated_gross_profit
      FROM dbo.Sales s
      INNER JOIN dbo.Users u ON s.user_id = u.user_id
      LEFT JOIN dbo.SaleItems si ON s.sale_id = si.sale_id
      WHERE 1=1
    `;

    if (userId) {
      request.input('userId', sql.Int, userId);
      query += ` AND s.user_id = @userId`;
    }

    if (startDate) {
      request.input('startDate', sql.DateTime2, startDate);
      query += ` AND s.sale_date >= @startDate`;
    }

    if (endDate) {
      request.input('endDate', sql.DateTime2, endDate);
      query += ` AND s.sale_date <= @endDate`;
    }

    query += `
      GROUP BY 
        s.sale_id, s.sale_date, s.user_id, u.full_name, 
        s.subtotal_amount, s.tax_amount, s.total_amount, s.status
      ORDER BY s.sale_date DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    request.input('limit', sql.Int, Math.min(Math.max(limit, 1), 200));
    request.input('offset', sql.Int, Math.max(offset, 0));

    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Retrieves single sale receipt with all line items.
   */
  async getSaleById(saleId) {
    const pool = await getPool();
    const request = pool.request();
    request.input('saleId', sql.Int, saleId);

    const headerRes = await request.query(`
      SELECT 
        s.sale_id,
        s.sale_date,
        s.user_id,
        u.full_name AS cashier_name,
        u.email AS cashier_email,
        s.subtotal_amount,
        s.tax_amount,
        s.total_amount,
        s.status
      FROM dbo.Sales s
      INNER JOIN dbo.Users u ON s.user_id = u.user_id
      WHERE s.sale_id = @saleId
    `);

    if (headerRes.recordset.length === 0) {
      return null;
    }

    const sale = headerRes.recordset[0];

    const itemsRes = await request.query(`
      SELECT 
        si.sale_item_id,
        si.product_id,
        p.sku,
        p.product_name,
        si.quantity,
        si.unit_selling_price,
        si.unit_cost_at_sale,
        si.subtotal,
        ((si.unit_selling_price - si.unit_cost_at_sale) * si.quantity) AS item_gross_profit
      FROM dbo.SaleItems si
      INNER JOIN dbo.Products p ON si.product_id = p.product_id
      WHERE si.sale_id = @saleId
      ORDER BY si.sale_item_id ASC
    `);

    sale.items = itemsRes.recordset;
    sale.grossProfit = sale.items.reduce((acc, i) => acc + (parseFloat(i.item_gross_profit) || 0), 0);

    return sale;
  }
}

module.exports = new SalesRepository();
