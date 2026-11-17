const { getPool, sql } = require('../config/database');

class AnalyticsRepository {
  /**
   * Retrieves high-level business KPI metrics.
   */
  async getExecutiveKPIs() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TOP 1 * FROM dbo.vw_BI_ExecutiveKPIs;
    `);
    return result.recordset[0] || {};
  }

  /**
   * Retrieves daily sales and revenue trends.
   */
  async getDailySalesTrends({ limit = 30 } = {}) {
    const pool = await getPool();
    const request = pool.request();
    request.input('limit', sql.Int, Math.min(Math.max(limit, 1), 365));

    const result = await request.query(`
      SELECT TOP (@limit) * 
      FROM dbo.vw_BI_DailySalesTrends
      ORDER BY sale_business_date DESC;
    `);
    return result.recordset.reverse(); // Return chronological
  }

  /**
   * Retrieves sales and valuation breakdown by category.
   */
  async getCategoryPerformance() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT * FROM dbo.vw_BI_CategoryPerformance
      ORDER BY total_category_revenue DESC;
    `);
    return result.recordset;
  }

  /**
   * Retrieves top selling products by total revenue.
   */
  async getTopProducts({ limit = 10 } = {}) {
    const pool = await getPool();
    const request = pool.request();
    request.input('limit', sql.Int, Math.min(Math.max(limit, 1), 50));

    const result = await request.query(`
      SELECT TOP (@limit) * 
      FROM dbo.vw_BI_TopProducts
      ORDER BY total_sales_revenue DESC;
    `);
    return result.recordset;
  }

  /**
   * Retrieves supplier fulfillment rates and purchase spend.
   */
  async getSupplierPerformance() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT * FROM dbo.vw_BI_SupplierPerformance
      ORDER BY total_po_spend DESC;
    `);
    return result.recordset;
  }
}

module.exports = new AnalyticsRepository();
