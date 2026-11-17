const request = require('supertest');
const sql = require('mssql');
const app = require('../../src/app');
const config = require('../../src/config/env');
const { closeDB } = require('../../src/config/database');

describe('Integration Tests: Phase 5 Business Intelligence, Reporting Views & Least-Privilege Access', () => {
  let adminToken;
  let managerToken;
  let staffToken;
  let biPool;

  beforeAll(async () => {
    // 1. Login Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@stockpilot.io', password: 'Password123!' });
    adminToken = adminRes.body.data.token;

    // 2. Login Manager
    const managerRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@stockpilot.io', password: 'Password123!' });
    managerToken = managerRes.body.data.token;

    // 3. Login Staff
    const staffRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'staff@stockpilot.io', password: 'Password123!' });
    staffToken = staffRes.body.data.token;

    // 4. Create dedicated read-only connection pool for stockpilot_bi_readonly
    const biConfig = {
      server: config.db.server,
      port: config.db.port,
      user: 'stockpilot_bi_readonly',
      password: 'YourStrong@Passw0rdBI!',
      database: 'StockPilotDB',
      options: config.db.options
    };

    biPool = await new sql.ConnectionPool(biConfig).connect();
  });

  afterAll(async () => {
    if (biPool) await biPool.close();
    await closeDB();
  });

  describe('Metabase / BI Least-Privilege Read-Only User Security', () => {
    test('stockpilot_bi_readonly connects and executes queries on reporting views', async () => {
      const result = await biPool.request().query('SELECT TOP 1 * FROM dbo.vw_BI_ExecutiveKPIs');
      expect(result.recordset).toBeDefined();
      expect(result.recordset.length).toBe(1);
    });

    test('stockpilot_bi_readonly is DENIED INSERT operations on operational tables', async () => {
      let threw = false;
      try {
        await biPool.request().query(`
          INSERT INTO dbo.Categories (category_name, description) VALUES ('Malicious', 'Attempt');
        `);
      } catch (err) {
        threw = true;
        expect(err.message).toMatch(/permission was denied|INSERT permission was denied/i);
      }
      expect(threw).toBe(true);
    });

    test('stockpilot_bi_readonly is DENIED UPDATE operations on operational tables', async () => {
      let threw = false;
      try {
        await biPool.request().query(`
          UPDATE dbo.Inventory SET on_hand_quantity = 9999 WHERE product_id = 1;
        `);
      } catch (err) {
        threw = true;
        expect(err.message).toMatch(/permission was denied|UPDATE permission was denied/i);
      }
      expect(threw).toBe(true);
    });

    test('stockpilot_bi_readonly is DENIED DELETE operations on operational tables', async () => {
      let threw = false;
      try {
        await biPool.request().query(`
          DELETE FROM dbo.Users WHERE user_id = 999;
        `);
      } catch (err) {
        threw = true;
        expect(err.message).toMatch(/permission was denied|DELETE permission was denied/i);
      }
      expect(threw).toBe(true);
    });
  });

  describe('BI Metric Reconciliation Against Raw Transaction Tables', () => {
    test('Total Gross Revenue in vw_BI_ExecutiveKPIs reconciles 100% with dbo.Sales', async () => {
      const res = await biPool.request().query(`
        SELECT 
          (SELECT total_gross_revenue FROM dbo.vw_BI_ExecutiveKPIs) AS bi_rev,
          (SELECT ISNULL(SUM(total_amount), 0) FROM dbo.Sales WHERE status = 'COMPLETED') AS source_rev
      `);
      const row = res.recordset[0];
      expect(parseFloat(row.bi_rev)).toBe(parseFloat(row.source_rev));
    });

    test('Total Inventory Valuation in vw_BI_ExecutiveKPIs reconciles 100% with Products & Inventory', async () => {
      const res = await biPool.request().query(`
        SELECT 
          (SELECT total_inventory_valuation FROM dbo.vw_BI_ExecutiveKPIs) AS bi_val,
          (SELECT ISNULL(SUM(i.on_hand_quantity * p.cost_price), 0) 
           FROM dbo.Products p 
           INNER JOIN dbo.Inventory i ON p.product_id = i.product_id 
           WHERE p.is_active = 1) AS source_val
      `);
      const row = res.recordset[0];
      expect(parseFloat(row.bi_val)).toBe(parseFloat(row.source_val));
    });

    test('Total Purchasing Spend in vw_BI_ExecutiveKPIs reconciles 100% with dbo.PurchaseOrders', async () => {
      const res = await biPool.request().query(`
        SELECT 
          (SELECT total_po_spend FROM dbo.vw_BI_ExecutiveKPIs) AS bi_spend,
          (SELECT ISNULL(SUM(total_amount), 0) FROM dbo.PurchaseOrders WHERE status <> 'CANCELLED') AS source_spend
      `);
      const row = res.recordset[0];
      expect(parseFloat(row.bi_spend)).toBe(parseFloat(row.source_spend));
    });
  });

  describe('REST Analytics Endpoints & RBAC Protection', () => {
    test('Staff is blocked from GET /api/analytics/executive with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/analytics/executive')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('Manager can access GET /api/analytics/executive with 200 OK', async () => {
      const res = await request(app)
        .get('/api/analytics/executive')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total_gross_revenue).toBeDefined();
      expect(res.body.data.total_inventory_valuation).toBeDefined();
      expect(res.body.data.gross_margin_percentage).toBeDefined();
    });

    test('GET /api/analytics/sales-trends returns chronological sales trend', async () => {
      const res = await request(app)
        .get('/api/analytics/sales-trends')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('GET /api/analytics/category-performance returns sales and valuation by category', async () => {
      const res = await request(app)
        .get('/api/analytics/category-performance')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].category_name).toBeDefined();
      expect(res.body.data[0].category_inventory_valuation).toBeDefined();
    });

    test('GET /api/analytics/top-products returns ranked product list', async () => {
      const res = await request(app)
        .get('/api/analytics/top-products')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        expect(res.body.data[0].product_name).toBeDefined();
        expect(res.body.data[0].total_sales_revenue).toBeDefined();
      }
    });

    test('GET /api/analytics/supplier-performance returns supplier fulfillment rates', async () => {
      const res = await request(app)
        .get('/api/analytics/supplier-performance')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        expect(res.body.data[0].supplier_name).toBeDefined();
        expect(res.body.data[0].fulfillment_rate_pct).toBeDefined();
      }
    });
  });
});
