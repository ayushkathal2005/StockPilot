const request = require('supertest');
const app = require('../../src/app');
const { connectDB, closeDB } = require('../../src/config/database');
const config = require('../../src/config/env');
const sql = require('mssql');

describe('E2E Lifecycle Test: StockPilot Complete Business Workflow (TPDS-III Modules 1-4)', () => {
  let pool;
  let adminToken;
  let managerToken;
  let staffToken;

  let testCategoryId;
  let testSupplierId;
  let testProductId;
  let testSku;
  let testPoId;
  let testPoItemId;
  let testSaleId;
  let testRecommendationId;
  let approvedPoId;

  beforeAll(async () => {
    pool = await connectDB();

    // Authenticate Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@stockpilot.io', password: 'Password123!' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.token;

    // Authenticate Manager
    const managerRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@stockpilot.io', password: 'Password123!' });
    expect(managerRes.status).toBe(200);
    managerToken = managerRes.body.data.token;

    // Authenticate Staff
    const staffRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'staff@stockpilot.io', password: 'Password123!' });
    expect(staffRes.status).toBe(200);
    staffToken = staffRes.body.data.token;

    testSku = `E2E-SKU-${Date.now().toString().slice(-6)}`;
  });

  afterAll(async () => {
    // Cleanup generated E2E entities to ensure test reproducibility
    if (pool && pool.connected) {
      if (testProductId) {
        await pool.request().query(`
          DELETE FROM dbo.StockMovements WHERE product_id = ${testProductId};
          DELETE FROM dbo.SaleItems WHERE product_id = ${testProductId};
          DELETE FROM dbo.PurchaseOrderItems WHERE product_id = ${testProductId};
          DELETE FROM dbo.ReplenishmentRecommendations WHERE product_id = ${testProductId};
          DELETE FROM dbo.DemandForecasts WHERE product_id = ${testProductId};
          DELETE FROM dbo.Inventory WHERE product_id = ${testProductId};
          DELETE FROM dbo.Products WHERE product_id = ${testProductId};
        `);
      }
      if (testSupplierId) {
        await pool.request().query(`
          DELETE FROM dbo.PurchaseOrders WHERE supplier_id = ${testSupplierId};
          DELETE FROM dbo.Suppliers WHERE supplier_id = ${testSupplierId};
        `);
      }
      if (testCategoryId) {
        await pool.request().query(`DELETE FROM dbo.Categories WHERE category_id = ${testCategoryId}`);
      }
    }
    await closeDB();
  });

  test('Step 1: System Health Probe validates Node.js app and SQL Server readiness', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('UP');
    expect(res.body.data.database.status).toBe('UP');
    expect(res.body.data.database.database).toBe('StockPilotDB');
  });

  test('Step 2: RBAC authorization boundary prevents Staff from creating master catalog data', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ categoryName: 'Unauthorized Category' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('Step 3: Master Data Creation: Admin creates Category, Supplier, and Product SKU', async () => {
    // 3a. Create Category
    const catRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryName: `E2E Category ${Date.now()}`,
        description: 'Category created during E2E verification'
      });
    expect(catRes.status).toBe(201);
    testCategoryId = catRes.body.data.category_id;

    // 3b. Create Supplier
    const supRes = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierName: `E2E Supplier ${Date.now()}`,
        contactName: 'E2E Logistics Rep',
        email: `e2e_supplier_${Date.now()}@example.com`,
        phone: '555-0199',
        leadTimeDays: 5
      });
    expect(supRes.status).toBe(201);
    testSupplierId = supRes.body.data.supplier_id;

    // 3c. Create Product
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: testSku,
        productName: 'E2E Autonomous Test SKU',
        categoryId: testCategoryId,
        preferredSupplierId: testSupplierId,
        costPrice: 25.00,
        sellingPrice: 49.99,
        reorderPointThreshold: 20,
        targetSafetyStock: 25,
        leadTimeDays: 5,
        initialStock: 0
      });
    expect(prodRes.status).toBe(201);
    testProductId = prodRes.body.data.product_id;

    // Verify initial inventory record exists with 0 stock
    const invRes = await request(app)
      .get(`/api/inventory?search=${testSku}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(invRes.status).toBe(200);
    const item = invRes.body.data.find(i => i.product_id === testProductId);
    expect(item).toBeDefined();
    expect(item.on_hand_quantity).toBe(0);
  });

  test('Step 4: Inbound Procurement: Manager creates, submits, and receives Purchase Order', async () => {
    // 4a. Create PO (Draft)
    const poCreateRes = await request(app)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        supplierId: testSupplierId,
        expectedDeliveryDate: '2026-12-01',
        items: [{ productId: testProductId, orderedQuantity: 50, unitCost: 25.00 }]
      });
    expect(poCreateRes.status).toBe(201);
    testPoId = poCreateRes.body.data.po_id;
    expect(poCreateRes.body.data.status).toBe('DRAFT');
    expect(poCreateRes.body.data.items.length).toBe(1);
    testPoItemId = poCreateRes.body.data.items[0].po_item_id;

    // 4b. Submit PO
    const poSubmitRes = await request(app)
      .post(`/api/purchase-orders/${testPoId}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});
    expect(poSubmitRes.status).toBe(200);
    expect(poSubmitRes.body.data.status).toBe('SUBMITTED');

    // 4c. Warehouse intake: receive PO items
    const poReceiveRes = await request(app)
      .post(`/api/purchase-orders/${testPoId}/receive`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        receipts: [{ poItemId: testPoItemId, quantityToReceive: 50 }]
      });
    expect(poReceiveRes.status).toBe(200);
    expect(poReceiveRes.body.data.status).toBe('RECEIVED');

    // 4d. Verify inventory is increased to 50 and movement ledger has an entry
    const invRes = await request(app)
      .get(`/api/inventory?search=${testSku}`)
      .set('Authorization', `Bearer ${staffToken}`);
    const item = invRes.body.data.find(i => i.product_id === testProductId);
    expect(item.on_hand_quantity).toBe(50);

    const movRes = await request(app)
      .get(`/api/inventory/movements?productId=${testProductId}&movementType=PO_RECEIPT`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(movRes.status).toBe(200);
    expect(movRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(movRes.body.data[0].quantity_delta).toBe(50);
  });

  test('Step 5: Point of Sale & Atomic Inventory Ledger Deductions', async () => {
    // 5a. Attempting to oversell (qty 60 > on_hand 50) fails atomically with 400
    const oversellRes = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        items: [{ productId: testProductId, quantity: 60 }]
      });
    expect(oversellRes.status).toBe(400);
    expect(oversellRes.body.error.code).toBe('INSUFFICIENT_STOCK');

    // 5b. Valid sale of 35 units succeeds
    const saleRes = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        items: [{ productId: testProductId, quantity: 35 }],
        paymentMethod: 'CASH'
      });
    expect(saleRes.status).toBe(201);
    testSaleId = saleRes.body.data.saleId;
    expect(Number(saleRes.body.data.totalAmount)).toBeCloseTo(1837.13, 2);

    // 5c. Verify inventory is atomically decremented: 50 - 35 = 15
    const invRes = await request(app)
      .get(`/api/inventory?search=${testSku}`)
      .set('Authorization', `Bearer ${staffToken}`);
    const item = invRes.body.data.find(i => i.product_id === testProductId);
    expect(item.on_hand_quantity).toBe(15);

    // 5d. Verify stock movement recorded for SALE
    const movRes = await request(app)
      .get(`/api/inventory/movements?productId=${testProductId}&movementType=SALE`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(movRes.status).toBe(200);
    expect(movRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(movRes.body.data[0].quantity_delta).toBe(-35);
  });

  test('Step 6: AI Demand Forecasting & Replenishment Recommendation Generation', async () => {
    // 6a. Generate forecast run across system (horizon = 14 days)
    const forecastRes = await request(app)
      .post('/api/forecast/generate')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ horizonDays: 14 });
    expect(forecastRes.status).toBe(201);
    expect(forecastRes.body.success).toBe(true);
    expect(forecastRes.body.data.runId).toBeDefined();

    // 6b. Retrieve recommendations
    const recRes = await request(app)
      .get('/api/forecast/recommendations?status=PENDING')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(recRes.status).toBe(200);
    expect(recRes.body.data.length).toBeGreaterThan(0);

    // Find pending recommendation for testing approval
    const targetRec = recRes.body.data.find(r => r.suggested_quantity > 0) || recRes.body.data[0];
    expect(targetRec).toBeDefined();
    testRecommendationId = targetRec.recommendation_id;
    expect(targetRec.status).toBe('PENDING');
  });

  test('Step 7: Manager Approval triggers PO Creation with Audit Trail', async () => {
    // 7a. Staff cannot approve recommendations
    const staffApprove = await request(app)
      .post(`/api/forecast/recommendations/${testRecommendationId}/approve`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(staffApprove.status).toBe(403);

    // 7b. Manager approves recommendation
    const managerApprove = await request(app)
      .post(`/api/forecast/recommendations/${testRecommendationId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(managerApprove.status).toBe(200);
    expect(managerApprove.body.success).toBe(true);
    expect(managerApprove.body.data.purchaseOrder).toBeDefined();
    approvedPoId = managerApprove.body.data.purchaseOrder.po_id;
    expect(managerApprove.body.data.purchaseOrder.status).toBe('SUBMITTED');

    // 7c. Repeated approval attempt fails with 400
    const dupApprove = await request(app)
      .post(`/api/forecast/recommendations/${testRecommendationId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(dupApprove.status).toBe(400);
  });

  test('Step 8: TPDS-III Module 1 Business Intelligence Metrics & Reconciliation', async () => {
    // 8a. Manager queries executive analytics endpoint
    const execRes = await request(app)
      .get('/api/analytics/executive')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(execRes.status).toBe(200);
    expect(execRes.body.data.total_gross_revenue).toBeDefined();
    expect(execRes.body.data.total_inventory_valuation).toBeDefined();
    expect(execRes.body.data.gross_margin_percentage).toBeDefined();

    // 8b. Connect using dedicated read-only BI credentials and reconcile KPI views
    const biConfig = {
      server: config.db.server,
      port: config.db.port,
      user: 'stockpilot_bi_readonly',
      password: 'YourStrong@Passw0rdBI!',
      database: 'StockPilotDB',
      options: config.db.options
    };

    const biPool = await new sql.ConnectionPool(biConfig).connect();
    const biViewRes = await biPool.request().query('SELECT * FROM dbo.vw_BI_ExecutiveKPIs');
    expect(biViewRes.recordset.length).toBe(1);
    const biKpi = biViewRes.recordset[0];

    // Reconcile total gross revenue against dbo.Sales sum
    const rawSalesRes = await biPool.request().query("SELECT ISNULL(SUM(total_amount), 0) AS raw_revenue FROM dbo.Sales WHERE status = 'COMPLETED'");
    const rawRevenue = Number(rawSalesRes.recordset[0].raw_revenue);
    expect(Number(biKpi.total_gross_revenue)).toBeCloseTo(rawRevenue, 2);

    await biPool.close();
  });
});
