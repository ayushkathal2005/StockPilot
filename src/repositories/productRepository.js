const { connectDB, sql } = require('../config/database');

class ProductRepository {
  async findAll({ search = null, categoryId = null, includeInactive = false, stockStatus = null } = {}) {
    const pool = await connectDB();
    const request = pool.request();

    let query = `
      SELECT 
        p.[product_id],
        p.[sku],
        p.[product_name],
        p.[category_id],
        c.[category_name],
        p.[preferred_supplier_id],
        s.[supplier_name],
        p.[cost_price],
        p.[selling_price],
        p.[reorder_point_threshold],
        p.[target_safety_stock],
        p.[lead_time_days],
        p.[is_active],
        ISNULL(i.[on_hand_quantity], 0) AS [on_hand_quantity],
        ISNULL(i.[reserved_quantity], 0) AS [reserved_quantity],
        (ISNULL(i.[on_hand_quantity], 0) - ISNULL(i.[reserved_quantity], 0)) AS [available_quantity],
        ISNULL(pos.open_po_qty, 0) AS [open_purchase_quantity],
        ((ISNULL(i.[on_hand_quantity], 0) - ISNULL(i.[reserved_quantity], 0)) + ISNULL(pos.open_po_qty, 0)) AS [inventory_position],
        CASE 
          WHEN (ISNULL(i.[on_hand_quantity], 0) - ISNULL(i.[reserved_quantity], 0)) <= 0 THEN 'OUT_OF_STOCK'
          WHEN (ISNULL(i.[on_hand_quantity], 0) - ISNULL(i.[reserved_quantity], 0)) <= p.[reorder_point_threshold] THEN 'LOW_STOCK'
          ELSE 'OPTIMAL'
        END AS [stock_health_status],
        p.[created_at],
        p.[updated_at]
      FROM [dbo].[Products] p
      INNER JOIN [dbo].[Categories] c ON p.[category_id] = c.[category_id]
      LEFT JOIN [dbo].[Suppliers] s ON p.[preferred_supplier_id] = s.[supplier_id]
      LEFT JOIN [dbo].[Inventory] i ON p.[product_id] = i.[product_id]
      LEFT JOIN (
        SELECT poi.[product_id], SUM(poi.[ordered_quantity] - poi.[received_quantity]) AS open_po_qty
        FROM [dbo].[PurchaseOrderItems] poi
        INNER JOIN [dbo].[PurchaseOrders] po ON poi.[po_id] = po.[po_id]
        WHERE po.[status] IN ('SUBMITTED', 'PARTIALLY_RECEIVED')
        GROUP BY poi.[product_id]
      ) pos ON p.[product_id] = pos.[product_id]
      WHERE 1=1
    `;

    if (!includeInactive) {
      query += ` AND p.[is_active] = 1`;
    }

    if (categoryId) {
      request.input('categoryId', sql.Int, categoryId);
      query += ` AND p.[category_id] = @categoryId`;
    }

    if (search) {
      request.input('search', sql.NVarChar(100), `%${search}%`);
      query += ` AND (p.[sku] LIKE @search OR p.[product_name] LIKE @search)`;
    }

    if (stockStatus === 'LOW_STOCK') {
      query += ` AND (ISNULL(i.[on_hand_quantity], 0) - ISNULL(i.[reserved_quantity], 0)) > 0 AND (ISNULL(i.[on_hand_quantity], 0) - ISNULL(i.[reserved_quantity], 0)) <= p.[reorder_point_threshold]`;
    } else if (stockStatus === 'OUT_OF_STOCK') {
      query += ` AND (ISNULL(i.[on_hand_quantity], 0) - ISNULL(i.[reserved_quantity], 0)) <= 0`;
    }

    query += ` ORDER BY p.[product_name] ASC;`;

    const result = await request.query(query);
    return result.recordset;
  }

  async findById(productId) {
    const pool = await connectDB();
    const result = await pool.request()
      .input('productId', sql.Int, productId)
      .query(`
        SELECT 
          p.[product_id],
          p.[sku],
          p.[product_name],
          p.[category_id],
          c.[category_name],
          p.[preferred_supplier_id],
          s.[supplier_name],
          p.[cost_price],
          p.[selling_price],
          p.[reorder_point_threshold],
          p.[target_safety_stock],
          p.[lead_time_days],
          p.[is_active],
          ISNULL(i.[on_hand_quantity], 0) AS [on_hand_quantity],
          ISNULL(i.[reserved_quantity], 0) AS [reserved_quantity],
          (ISNULL(i.[on_hand_quantity], 0) - ISNULL(i.[reserved_quantity], 0)) AS [available_quantity],
          p.[created_at],
          p.[updated_at]
        FROM [dbo].[Products] p
        INNER JOIN [dbo].[Categories] c ON p.[category_id] = c.[category_id]
        LEFT JOIN [dbo].[Suppliers] s ON p.[preferred_supplier_id] = s.[supplier_id]
        LEFT JOIN [dbo].[Inventory] i ON p.[product_id] = i.[product_id]
        WHERE p.[product_id] = @productId;
      `);

    return result.recordset[0] || null;
  }

  async findBySku(sku) {
    const pool = await connectDB();
    const result = await pool.request()
      .input('sku', sql.NVarChar(50), sku)
      .query(`
        SELECT [product_id], [sku], [product_name], [is_active]
        FROM [dbo].[Products]
        WHERE [sku] = @sku;
      `);

    return result.recordset[0] || null;
  }

  async create(data, actorUserId = 1) {
    const pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Insert into Products
      const productReq = new sql.Request(transaction);
      productReq.input('sku', sql.NVarChar(50), data.sku)
        .input('productName', sql.NVarChar(200), data.productName)
        .input('categoryId', sql.Int, data.categoryId)
        .input('preferredSupplierId', sql.Int, data.preferredSupplierId || null)
        .input('costPrice', sql.Decimal(18, 4), data.costPrice)
        .input('sellingPrice', sql.Decimal(18, 4), data.sellingPrice)
        .input('reorderPoint', sql.Int, data.reorderPointThreshold || 10)
        .input('safetyStock', sql.Int, data.targetSafetyStock || 15)
        .input('leadTimeDays', sql.Int, data.leadTimeDays || 7);

      const productResult = await productReq.query(`
        INSERT INTO [dbo].[Products] (
          [sku], [product_name], [category_id], [preferred_supplier_id],
          [cost_price], [selling_price], [reorder_point_threshold],
          [target_safety_stock], [lead_time_days], [is_active], [created_at], [updated_at]
        )
        OUTPUT INSERTED.[product_id], INSERTED.[sku], INSERTED.[product_name]
        VALUES (
          @sku, @productName, @categoryId, @preferredSupplierId,
          @costPrice, @sellingPrice, @reorderPoint,
          @safetyStock, @leadTimeDays, 1, SYSUTCDATETIME(), SYSUTCDATETIME()
        );
      `);

      const productId = productResult.recordset[0].product_id;
      const initialStock = parseInt(data.initialStock || 0, 10);

      // 2. Insert into Inventory
      const invReq = new sql.Request(transaction);
      invReq.input('productId', sql.Int, productId)
        .input('onHandQuantity', sql.Int, initialStock);

      await invReq.query(`
        INSERT INTO [dbo].[Inventory] ([product_id], [on_hand_quantity], [reserved_quantity], [updated_at])
        VALUES (@productId, @onHandQuantity, 0, SYSUTCDATETIME());
      `);

      // 3. Record opening movement in StockMovements ledger if initialStock > 0
      if (initialStock > 0) {
        const moveReq = new sql.Request(transaction);
        moveReq.input('productId', sql.Int, productId)
          .input('delta', sql.Int, initialStock)
          .input('userId', sql.Int, actorUserId);

        await moveReq.query(`
          INSERT INTO [dbo].[StockMovements] (
            [product_id], [movement_type], [quantity_delta],
            [reference_type], [reference_id], [created_by_user_id], [created_at], [notes]
          )
          VALUES (
            @productId, 'ADJUSTMENT_IN', @delta,
            'Products', @productId, @userId, SYSUTCDATETIME(), 'Initial stock opening balance'
          );
        `);
      }

      await transaction.commit();
      return this.findById(productId);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  async update(productId, data) {
    const pool = await connectDB();
    const request = pool.request().input('productId', sql.Int, productId);

    const updates = ['[updated_at] = SYSUTCDATETIME()'];
    if (data.productName !== undefined) {
      request.input('productName', sql.NVarChar(200), data.productName);
      updates.push('[product_name] = @productName');
    }
    if (data.categoryId !== undefined) {
      request.input('categoryId', sql.Int, data.categoryId);
      updates.push('[category_id] = @categoryId');
    }
    if (data.preferredSupplierId !== undefined) {
      request.input('preferredSupplierId', sql.Int, data.preferredSupplierId || null);
      updates.push('[preferred_supplier_id] = @preferredSupplierId');
    }
    if (data.costPrice !== undefined) {
      request.input('costPrice', sql.Decimal(18, 4), data.costPrice);
      updates.push('[cost_price] = @costPrice');
    }
    if (data.sellingPrice !== undefined) {
      request.input('sellingPrice', sql.Decimal(18, 4), data.sellingPrice);
      updates.push('[selling_price] = @sellingPrice');
    }
    if (data.reorderPointThreshold !== undefined) {
      request.input('reorderPoint', sql.Int, data.reorderPointThreshold);
      updates.push('[reorder_point_threshold] = @reorderPoint');
    }
    if (data.targetSafetyStock !== undefined) {
      request.input('safetyStock', sql.Int, data.targetSafetyStock);
      updates.push('[target_safety_stock] = @safetyStock');
    }
    if (data.leadTimeDays !== undefined) {
      request.input('leadTimeDays', sql.Int, data.leadTimeDays);
      updates.push('[lead_time_days] = @leadTimeDays');
    }
    if (data.isActive !== undefined) {
      request.input('isActive', sql.Bit, data.isActive ? 1 : 0);
      updates.push('[is_active] = @isActive');
    }

    const query = `
      UPDATE [dbo].[Products]
      SET ${updates.join(', ')}
      WHERE [product_id] = @productId;
    `;

    await request.query(query);
    return this.findById(productId);
  }

  async deactivate(productId) {
    const pool = await connectDB();
    const result = await pool.request()
      .input('productId', sql.Int, productId)
      .query(`
        UPDATE [dbo].[Products]
        SET [is_active] = 0, [updated_at] = SYSUTCDATETIME()
        OUTPUT INSERTED.[product_id], INSERTED.[sku], INSERTED.[is_active]
        WHERE [product_id] = @productId;
      `);

    return result.recordset[0] || null;
  }
}

module.exports = new ProductRepository();
