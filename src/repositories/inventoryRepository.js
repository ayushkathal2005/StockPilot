const { getPool, sql } = require('../config/database');

class InventoryRepository {
  /**
   * Retrieves current stock positions across all active products.
   */
  async getInventoryPositions({ categoryId, stockHealth, search } = {}) {
    const pool = await getPool();
    const request = pool.request();

    let query = `
      SELECT 
        p.product_id,
        p.sku,
        p.product_name,
        p.category_id,
        c.category_name,
        p.cost_price,
        p.selling_price,
        p.reorder_point_threshold,
        p.target_safety_stock,
        p.lead_time_days,
        i.on_hand_quantity,
        i.reserved_quantity,
        (i.on_hand_quantity - i.reserved_quantity) AS available_quantity,
        ISNULL(po_agg.open_purchase_quantity, 0) AS open_purchase_quantity,
        (i.on_hand_quantity - i.reserved_quantity + ISNULL(po_agg.open_purchase_quantity, 0)) AS inventory_position,
        (i.on_hand_quantity * p.cost_price) AS inventory_valuation,
        CASE
          WHEN i.on_hand_quantity <= 0 THEN 'OUT_OF_STOCK'
          WHEN i.on_hand_quantity <= p.reorder_point_threshold THEN 'LOW_STOCK'
          ELSE 'HEALTHY'
        END AS stock_health_status,
        i.updated_at
      FROM dbo.Products p
      INNER JOIN dbo.Inventory i ON p.product_id = i.product_id
      INNER JOIN dbo.Categories c ON p.category_id = c.category_id
      LEFT JOIN (
        SELECT 
          poi.product_id,
          SUM(poi.ordered_quantity - poi.received_quantity) AS open_purchase_quantity
        FROM dbo.PurchaseOrderItems poi
        INNER JOIN dbo.PurchaseOrders po ON poi.po_id = po.po_id
        WHERE po.status IN ('SUBMITTED', 'PARTIALLY_RECEIVED')
        GROUP BY poi.product_id
      ) po_agg ON p.product_id = po_agg.product_id
      WHERE p.is_active = 1
    `;

    if (categoryId) {
      request.input('categoryId', sql.Int, categoryId);
      query += ` AND p.category_id = @categoryId`;
    }

    if (search) {
      request.input('search', sql.NVarChar(100), `%${search}%`);
      query += ` AND (p.product_name LIKE @search OR p.sku LIKE @search)`;
    }

    if (stockHealth === 'OUT_OF_STOCK') {
      query += ` AND i.on_hand_quantity <= 0`;
    } else if (stockHealth === 'LOW_STOCK') {
      query += ` AND i.on_hand_quantity > 0 AND i.on_hand_quantity <= p.reorder_point_threshold`;
    } else if (stockHealth === 'HEALTHY') {
      query += ` AND i.on_hand_quantity > p.reorder_point_threshold`;
    }

    query += ` ORDER BY p.product_name ASC`;

    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Retrieves stock movement ledger entries with optional filters.
   */
  async getStockMovements({ productId, movementType, limit = 100, offset = 0 } = {}) {
    const pool = await getPool();
    const request = pool.request();

    let query = `
      SELECT 
        sm.movement_id,
        sm.product_id,
        p.sku,
        p.product_name,
        sm.movement_type,
        sm.quantity_delta,
        sm.reference_type,
        sm.reference_id,
        sm.created_by_user_id,
        u.full_name AS created_by_name,
        sm.created_at,
        sm.notes
      FROM dbo.StockMovements sm
      INNER JOIN dbo.Products p ON sm.product_id = p.product_id
      INNER JOIN dbo.Users u ON sm.created_by_user_id = u.user_id
      WHERE 1=1
    `;

    if (productId) {
      request.input('productId', sql.Int, productId);
      query += ` AND sm.product_id = @productId`;
    }

    if (movementType) {
      request.input('movementType', sql.NVarChar(25), movementType);
      query += ` AND sm.movement_type = @movementType`;
    }

    request.input('limit', sql.Int, Math.min(Math.max(limit, 1), 500));
    request.input('offset', sql.Int, Math.max(offset, 0));

    query += ` ORDER BY sm.movement_id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;

    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Performs an atomic manual inventory adjustment.
   */
  async adjustStock({ productId, quantityDelta, movementType, userId, notes }) {
    const pool = await getPool();
    const transaction = pool.transaction();

    try {
      await transaction.begin();

      // Lock row for update
      const checkReq = transaction.request();
      checkReq.input('productId', sql.Int, productId);
      const checkRes = await checkReq.query(`
        SELECT on_hand_quantity, reserved_quantity 
        FROM dbo.Inventory WITH (UPDLOCK, ROWLOCK)
        WHERE product_id = @productId
      `);

      if (checkRes.recordset.length === 0) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      const current = checkRes.recordset[0];
      const newOnHand = current.on_hand_quantity + quantityDelta;

      if (newOnHand < 0) {
        throw new Error('NEGATIVE_STOCK_NOT_ALLOWED');
      }

      // Update Inventory
      const updReq = transaction.request();
      updReq.input('productId', sql.Int, productId);
      updReq.input('newOnHand', sql.Int, newOnHand);
      await updReq.query(`
        UPDATE dbo.Inventory
        SET on_hand_quantity = @newOnHand,
            updated_at = SYSUTCDATETIME()
        WHERE product_id = @productId
      `);

      // Record movement ledger
      const movReq = transaction.request();
      movReq.input('productId', sql.Int, productId);
      movReq.input('movementType', sql.NVarChar(25), movementType);
      movReq.input('quantityDelta', sql.Int, quantityDelta);
      movReq.input('userId', sql.Int, userId);
      movReq.input('notes', sql.NVarChar(500), notes || null);
      await movReq.query(`
        INSERT INTO dbo.StockMovements (
          product_id, movement_type, quantity_delta, reference_type, reference_id, created_by_user_id, notes
        ) VALUES (
          @productId, @movementType, @quantityDelta, 'MANUAL_ADJUSTMENT', NULL, @userId, @notes
        )
      `);

      await transaction.commit();

      return {
        productId,
        previousOnHand: current.on_hand_quantity,
        newOnHand,
        quantityDelta,
        movementType
      };
    } catch (err) {
      if (transaction._acquiredConnection) {
        await transaction.rollback();
      }
      throw err;
    }
  }

  /**
   * Retrieves rule-based reorder alerts based on threshold and moving demand.
   */
  async getReorderAlerts() {
    const pool = await getPool();
    const query = `
      SELECT 
        p.product_id,
        p.sku,
        p.product_name,
        c.category_name,
        p.cost_price,
        p.selling_price,
        p.reorder_point_threshold,
        p.target_safety_stock,
        p.lead_time_days,
        p.preferred_supplier_id,
        s.supplier_name AS preferred_supplier_name,
        i.on_hand_quantity,
        i.reserved_quantity,
        (i.on_hand_quantity - i.reserved_quantity) AS available_quantity,
        ISNULL(po_agg.open_purchase_quantity, 0) AS open_purchase_quantity,
        (i.on_hand_quantity - i.reserved_quantity + ISNULL(po_agg.open_purchase_quantity, 0)) AS inventory_position,
        -- Suggested reorder quantity = Target Safety Stock + (Reorder Threshold - Inventory Position)
        CASE 
          WHEN (i.on_hand_quantity - i.reserved_quantity + ISNULL(po_agg.open_purchase_quantity, 0)) <= p.reorder_point_threshold
          THEN (p.target_safety_stock + (p.reorder_point_threshold - (i.on_hand_quantity - i.reserved_quantity + ISNULL(po_agg.open_purchase_quantity, 0))))
          ELSE 0
        END AS suggested_reorder_quantity,
        CASE
          WHEN i.on_hand_quantity <= 0 THEN 'CRITICAL_STOCKOUT'
          WHEN (i.on_hand_quantity - i.reserved_quantity + ISNULL(po_agg.open_purchase_quantity, 0)) <= p.reorder_point_threshold THEN 'REORDER_NEEDED'
          ELSE 'SUFFICIENT'
        END AS alert_level
      FROM dbo.Products p
      INNER JOIN dbo.Inventory i ON p.product_id = i.product_id
      INNER JOIN dbo.Categories c ON p.category_id = c.category_id
      LEFT JOIN dbo.Suppliers s ON p.preferred_supplier_id = s.supplier_id
      LEFT JOIN (
        SELECT 
          poi.product_id,
          SUM(poi.ordered_quantity - poi.received_quantity) AS open_purchase_quantity
        FROM dbo.PurchaseOrderItems poi
        INNER JOIN dbo.PurchaseOrders po ON poi.po_id = po.po_id
        WHERE po.status IN ('SUBMITTED', 'PARTIALLY_RECEIVED')
        GROUP BY poi.product_id
      ) po_agg ON p.product_id = po_agg.product_id
      WHERE p.is_active = 1
        AND (i.on_hand_quantity - i.reserved_quantity + ISNULL(po_agg.open_purchase_quantity, 0)) <= p.reorder_point_threshold
      ORDER BY 
        CASE WHEN i.on_hand_quantity <= 0 THEN 0 ELSE 1 END,
        inventory_position ASC
    `;

    const result = await pool.request().query(query);
    return result.recordset;
  }
}

module.exports = new InventoryRepository();
