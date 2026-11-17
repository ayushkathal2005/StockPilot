/**
 * StockPilot Forecast & Replenishment Repository
 * Phase 7: SQL Server persistence for ForecastRuns, DemandForecasts, and ReplenishmentRecommendations.
 */

const { getPool, sql } = require('../config/database');

class ForecastRepository {
  /**
   * Creates a new ForecastRun record.
   */
  async createForecastRun({
    modelVersion = 'v1.0.0',
    horizonDays = 14,
    trainStartDate = null,
    trainEndDate = null,
    testWape = null,
    testMae = null,
    testRmse = null,
    status = 'COMPLETED'
  }) {
    const pool = await getPool();
    const query = `
      INSERT INTO dbo.ForecastRuns (
        model_version, horizon_days, train_start_date, train_end_date,
        test_wape, test_mae, test_rmse, status
      )
      OUTPUT INSERTED.run_id, INSERTED.run_timestamp
      VALUES (
        @modelVersion, @horizonDays, @trainStartDate, @trainEndDate,
        @testWape, @testMae, @testRmse, @status
      );
    `;

    const request = pool.request()
      .input('modelVersion', sql.NVarChar(50), modelVersion)
      .input('horizonDays', sql.Int, horizonDays)
      .input('trainStartDate', sql.Date, trainStartDate)
      .input('trainEndDate', sql.Date, trainEndDate)
      .input('testWape', sql.Decimal(8, 4), testWape)
      .input('testMae', sql.Decimal(8, 4), testMae)
      .input('testRmse', sql.Decimal(8, 4), testRmse)
      .input('status', sql.NVarChar(20), status);

    const result = await request.query(query);
    return result.recordset[0];
  }

  /**
   * Saves product daily demand forecasts linked to a run.
   */
  async saveDemandForecasts(runId, forecastItems) {
    if (!forecastItems || forecastItems.length === 0) return 0;

    const pool = await getPool();
    const table = new sql.Table('dbo.DemandForecasts');
    table.create = false;
    table.columns.add('run_id', sql.Int, { nullable: false });
    table.columns.add('product_id', sql.Int, { nullable: false });
    table.columns.add('forecast_date', sql.Date, { nullable: false });
    table.columns.add('predicted_units', sql.Decimal(10, 2), { nullable: false });
    table.columns.add('forecast_source', sql.NVarChar(30), { nullable: false });

    for (const item of forecastItems) {
      table.rows.add(
        runId,
        item.productId,
        item.forecastDate,
        item.predictedUnits,
        item.forecastSource || 'xgboost'
      );
    }

    const req = pool.request();
    await req.bulk(table, { checkConstraints: true });
    return forecastItems.length;
  }

  /**
   * Saves replenishment recommendations in bulk.
   */
  async saveRecommendations(recommendations) {
    if (!recommendations || recommendations.length === 0) return [];

    const pool = await getPool();
    const table = new sql.Table('dbo.ReplenishmentRecommendations');
    table.create = false;
    table.columns.add('product_id', sql.Int, { nullable: false });
    table.columns.add('run_id', sql.Int, { nullable: true });
    table.columns.add('current_on_hand', sql.Int, { nullable: false });
    table.columns.add('open_purchase_quantity', sql.Int, { nullable: false });
    table.columns.add('inventory_position', sql.Int, { nullable: false });
    table.columns.add('lead_time_demand', sql.Decimal(10, 2), { nullable: false });
    table.columns.add('target_horizon_demand', sql.Decimal(10, 2), { nullable: false });
    table.columns.add('safety_stock', sql.Decimal(10, 2), { nullable: false });
    table.columns.add('target_stock', sql.Decimal(10, 2), { nullable: false });
    table.columns.add('suggested_quantity', sql.Int, { nullable: false });
    table.columns.add('recommendation_source', sql.NVarChar(30), { nullable: false });
    table.columns.add('status', sql.NVarChar(20), { nullable: false });

    for (const r of recommendations) {
      table.rows.add(
        r.productId,
        r.runId || null,
        r.currentOnHand,
        r.openPurchaseQuantity,
        r.inventoryPosition,
        r.leadTimeDemand,
        r.targetHorizonDemand,
        r.safetyStock,
        r.targetStock,
        r.suggestedQuantity,
        r.recommendationSource || 'xgboost',
        r.status || 'PENDING'
      );
    }

    const req = pool.request();
    await req.bulk(table, { checkConstraints: true });
    return recommendations;
  }

  /**
   * Retrieves active products and calculates their current inventory position.
   * inventory_position = on_hand - reserved + open_purchase_quantity
   * (Draft and cancelled purchase orders do NOT count).
   */
  async getProductInventoryPositions() {
    const pool = await getPool();
    const query = `
      SELECT 
        p.product_id,
        p.sku,
        p.product_name,
        p.category_id,
        c.category_name,
        p.preferred_supplier_id,
        s.supplier_name,
        p.cost_price,
        p.selling_price,
        p.lead_time_days,
        ISNULL(i.on_hand_quantity, 0) AS on_hand_quantity,
        ISNULL(i.reserved_quantity, 0) AS reserved_quantity,
        ISNULL(open_po.open_qty, 0) AS open_purchase_quantity,
        (ISNULL(i.on_hand_quantity, 0) - ISNULL(i.reserved_quantity, 0) + ISNULL(open_po.open_qty, 0)) AS inventory_position
      FROM dbo.Products p
      INNER JOIN dbo.Categories c ON p.category_id = c.category_id
      LEFT JOIN dbo.Suppliers s ON p.preferred_supplier_id = s.supplier_id
      LEFT JOIN dbo.Inventory i ON p.product_id = i.product_id
      LEFT JOIN (
        SELECT 
          poi.product_id,
          SUM(poi.ordered_quantity - poi.received_quantity) AS open_qty
        FROM dbo.PurchaseOrders po
        INNER JOIN dbo.PurchaseOrderItems poi ON po.po_id = poi.po_id
        WHERE po.status IN ('SUBMITTED', 'PARTIALLY_RECEIVED')
        GROUP BY poi.product_id
      ) open_po ON p.product_id = open_po.product_id
      WHERE p.is_active = 1
      ORDER BY p.product_id ASC;
    `;

    const result = await pool.request().query(query);
    return result.recordset;
  }

  /**
   * Queries list of historical forecast runs.
   */
  async getForecastRuns(limit = 20) {
    const pool = await getPool();
    const query = `
      SELECT TOP (@limit)
        run_id,
        model_version,
        run_timestamp,
        horizon_days,
        train_start_date,
        train_end_date,
        test_wape,
        test_mae,
        test_rmse,
        status
      FROM dbo.ForecastRuns
      ORDER BY run_timestamp DESC;
    `;

    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(query);
    return result.recordset;
  }

  /**
   * Queries single forecast run with summary product metrics.
   */
  async getForecastRunById(runId) {
    const pool = await getPool();
    const runQuery = `
      SELECT * FROM dbo.ForecastRuns WHERE run_id = @runId;
    `;
    const runResult = await pool.request()
      .input('runId', sql.Int, runId)
      .query(runQuery);

    if (runResult.recordset.length === 0) return null;
    const run = runResult.recordset[0];

    const forecastsQuery = `
      SELECT 
        df.forecast_id,
        df.product_id,
        p.sku,
        p.product_name,
        df.forecast_date,
        df.predicted_units,
        df.forecast_source
      FROM dbo.DemandForecasts df
      INNER JOIN dbo.Products p ON df.product_id = p.product_id
      WHERE df.run_id = @runId
      ORDER BY df.product_id, df.forecast_date;
    `;

    const forecastsResult = await pool.request()
      .input('runId', sql.Int, runId)
      .query(forecastsQuery);

    run.forecasts = forecastsResult.recordset;
    return run;
  }

  /**
   * Queries recommendations list with filters.
   */
  async getRecommendations({ status = null, productId = null, limit = 100 } = {}) {
    const pool = await getPool();
    let query = `
      SELECT TOP (@limit)
        r.recommendation_id,
        r.product_id,
        p.sku,
        p.product_name,
        c.category_name,
        p.preferred_supplier_id,
        s.supplier_name,
        p.cost_price,
        p.lead_time_days,
        r.run_id,
        r.current_on_hand,
        r.open_purchase_quantity,
        r.inventory_position,
        r.lead_time_demand,
        r.target_horizon_demand,
        r.safety_stock,
        r.target_stock,
        r.suggested_quantity,
        r.recommendation_source,
        r.status,
        r.created_at
      FROM dbo.ReplenishmentRecommendations r
      INNER JOIN dbo.Products p ON r.product_id = p.product_id
      INNER JOIN dbo.Categories c ON p.category_id = c.category_id
      LEFT JOIN dbo.Suppliers s ON p.preferred_supplier_id = s.supplier_id
      WHERE 1=1
    `;

    const req = pool.request().input('limit', sql.Int, limit);

    if (status) {
      query += ' AND r.status = @status';
      req.input('status', sql.NVarChar(20), status);
    }

    if (productId) {
      query += ' AND r.product_id = @productId';
      req.input('productId', sql.Int, productId);
    }

    query += ' ORDER BY r.created_at DESC, r.suggested_quantity DESC;';

    const result = await req.query(query);
    return result.recordset;
  }

  /**
   * Retrieves single recommendation by ID.
   */
  async getRecommendationById(recommendationId) {
    const pool = await getPool();
    const query = `
      SELECT 
        r.*,
        p.sku,
        p.product_name,
        p.preferred_supplier_id,
        s.supplier_name,
        p.cost_price,
        p.lead_time_days
      FROM dbo.ReplenishmentRecommendations r
      INNER JOIN dbo.Products p ON r.product_id = p.product_id
      LEFT JOIN dbo.Suppliers s ON p.preferred_supplier_id = s.supplier_id
      WHERE r.recommendation_id = @id;
    `;

    const result = await pool.request()
      .input('id', sql.Int, recommendationId)
      .query(query);
    return result.recordset[0] || null;
  }

  /**
   * Updates recommendation status.
   */
  async updateRecommendationStatus(recommendationId, newStatus) {
    const pool = await getPool();
    const query = `
      UPDATE dbo.ReplenishmentRecommendations
      SET status = @newStatus
      WHERE recommendation_id = @id;
    `;

    await pool.request()
      .input('id', sql.Int, recommendationId)
      .input('newStatus', sql.NVarChar(20), newStatus)
      .query(query);
  }
}

module.exports = new ForecastRepository();
