const request = require('supertest');
const app = require('../../src/app');
const { getPool, closeDB } = require('../../src/config/database');

describe('Integration Tests: Phase 4 Inventory Ledger, Sales, and Purchase Orders', () => {
  let adminToken;
  let managerToken;
  let staffToken;
  let testProductId;
  let testSupplierId;
  let testPoId;
  let testPoItemId;

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

    // 4. Create an isolated product for Phase 4 tests
    const uniqueSku = `P4-TEST-${Date.now()}`;
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        sku: uniqueSku,
        productName: 'Phase 4 Invariant Test SKU',
        categoryId: 1,
        preferredSupplierId: 1,
        costPrice: 10.00,
        sellingPrice: 25.00,
        reorderPointThreshold: 15,
        targetSafetyStock: 20,
        leadTimeDays: 7,
        initialStock: 20 // Starts with 20 units
      });

    testProductId = prodRes.body.data.product_id;
    testSupplierId = 1;
  });

  afterAll(async () => {
    await closeDB();
  });

  describe('Sales Recording, Atomic Inventory Deduction & Invariants', () => {
    test('POST /api/sales successfully creates sale, freezes unit_cost_at_sale, deducts inventory, and records stock movement', async () => {
      const saleRes = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          items: [
            { productId: testProductId, quantity: 5 }
          ]
        });

      expect(saleRes.status).toBe(201);
      expect(saleRes.body.success).toBe(true);
      const sale = saleRes.body.data;
      expect(sale.saleId).toBeDefined();
      expect(sale.items.length).toBe(1);
      expect(sale.items[0].quantity).toBe(5);
      expect(parseFloat(sale.items[0].unitSellingPrice)).toBe(25.00);
      expect(parseFloat(sale.items[0].unitCostAtSale)).toBe(10.00); // Frozen cost

      // Verify stock was decremented from 20 to 15
      const invRes = await request(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${staffToken}`)
        .query({ search: 'Phase 4 Invariant Test SKU' });

      expect(invRes.status).toBe(200);
      const item = invRes.body.data.find(p => p.product_id === testProductId);
      expect(item.on_hand_quantity).toBe(15);
      expect(item.available_quantity).toBe(15);

      // Verify stock movement ledger has SALE record
      const movRes = await request(app)
        .get('/api/inventory/movements')
        .set('Authorization', `Bearer ${staffToken}`)
        .query({ productId: testProductId, movementType: 'SALE' });

      expect(movRes.status).toBe(200);
      expect(movRes.body.data.length).toBeGreaterThanOrEqual(1);
      const saleMov = movRes.body.data.find(m => m.reference_id === sale.saleId);
      expect(saleMov).toBeDefined();
      expect(saleMov.quantity_delta).toBe(-5);
      expect(saleMov.reference_type).toBe('SALE');
    });

    test('POST /api/sales with insufficient stock rolls back atomically without partial writes', async () => {
      // Current on-hand is 15. Request 20 units (which exceeds available stock)
      const saleRes = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          items: [
            { productId: testProductId, quantity: 20 }
          ]
        });

      expect(saleRes.status).toBe(400);
      expect(saleRes.body.success).toBe(false);
      expect(saleRes.body.error.code).toBe('INSUFFICIENT_STOCK');

      // Verify on-hand remains strictly 15
      const invRes = await request(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${staffToken}`)
        .query({ search: 'Phase 4 Invariant Test SKU' });

      const item = invRes.body.data.find(p => p.product_id === testProductId);
      expect(item.on_hand_quantity).toBe(15);
    });

    test('Concurrent sales cannot oversell stock (concurrency control with UPDLOCK)', async () => {
      // Current stock is 15. Run two parallel requests for 10 units each (total 20 > 15)
      // Exactly one must succeed and one must fail with INSUFFICIENT_STOCK
      const [res1, res2] = await Promise.all([
        request(app).post('/api/sales').set('Authorization', `Bearer ${staffToken}`).send({ items: [{ productId: testProductId, quantity: 10 }] }),
        request(app).post('/api/sales').set('Authorization', `Bearer ${staffToken}`).send({ items: [{ productId: testProductId, quantity: 10 }] })
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 400]);

      // Verify on-hand stock is exactly 5 (15 - 10)
      const invRes = await request(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${staffToken}`)
        .query({ search: 'Phase 4 Invariant Test SKU' });

      const item = invRes.body.data.find(p => p.product_id === testProductId);
      expect(item.on_hand_quantity).toBe(5);
    });
  });

  describe('Purchase Orders Lifecycle & Inbound Warehouse Receiving', () => {
    test('POST /api/purchase-orders creates a DRAFT PO without counting as open inventory', async () => {
      const poRes = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          supplierId: testSupplierId,
          expectedDeliveryDate: '2026-12-01',
          items: [
            { productId: testProductId, orderedQuantity: 50, unitCost: 10.00 }
          ]
        });

      expect(poRes.status).toBe(201);
      expect(poRes.body.data.status).toBe('DRAFT');
      testPoId = poRes.body.data.po_id;
      testPoItemId = poRes.body.data.items[0].po_item_id;

      // Invariant: Draft PO must NOT count in open_purchase_quantity
      const invRes = await request(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${staffToken}`)
        .query({ search: 'Phase 4 Invariant Test SKU' });

      const item = invRes.body.data.find(p => p.product_id === testProductId);
      expect(item.open_purchase_quantity).toBe(0);
      expect(item.inventory_position).toBe(5);
    });

    test('POST /api/purchase-orders/:id/submit approves PO and includes it in inventory position', async () => {
      const submitRes = await request(app)
        .post(`/api/purchase-orders/${testPoId}/submit`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.data.status).toBe('SUBMITTED');

      // Invariant: Submitted PO NOW counts in open_purchase_quantity and inventory_position
      const invRes = await request(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${staffToken}`)
        .query({ search: 'Phase 4 Invariant Test SKU' });

      const item = invRes.body.data.find(p => p.product_id === testProductId);
      expect(item.open_purchase_quantity).toBe(50);
      expect(item.inventory_position).toBe(55); // 5 on hand + 50 open
    });

    test('POST /api/purchase-orders/:id/receive supports partial receiving and increments stock', async () => {
      // Partially receive 20 out of 50 units
      const recRes = await request(app)
        .post(`/api/purchase-orders/${testPoId}/receive`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          receipts: [
            { poItemId: testPoItemId, quantityToReceive: 20 }
          ]
        });

      expect(recRes.status).toBe(200);
      expect(recRes.body.data.status).toBe('PARTIALLY_RECEIVED');
      expect(recRes.body.data.items[0].received_quantity).toBe(20);
      expect(recRes.body.data.items[0].remaining_quantity).toBe(30);

      // Verify on-hand stock increased by exactly 20 (5 + 20 = 25)
      const invRes = await request(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${staffToken}`)
        .query({ search: 'Phase 4 Invariant Test SKU' });

      const item = invRes.body.data.find(p => p.product_id === testProductId);
      expect(item.on_hand_quantity).toBe(25);
      expect(item.open_purchase_quantity).toBe(30);
      expect(item.inventory_position).toBe(55); // 25 + 30 = 55 (invariant preserved)
    });

    test('POST /api/purchase-orders/:id/receive rejects receiving more than remaining ordered quantity', async () => {
      // Remaining is 30. Attempt to receive 31 units
      const recRes = await request(app)
        .post(`/api/purchase-orders/${testPoId}/receive`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          receipts: [
            { poItemId: testPoItemId, quantityToReceive: 31 }
          ]
        });

      expect(recRes.status).toBe(400);
      expect(recRes.body.error.code).toBe('EXCEEDS_ORDERED_QUANTITY');

      // Verify stock was not modified
      const invRes = await request(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${staffToken}`)
        .query({ search: 'Phase 4 Invariant Test SKU' });

      const item = invRes.body.data.find(p => p.product_id === testProductId);
      expect(item.on_hand_quantity).toBe(25);
    });

    test('POST /api/purchase-orders/:id/receive completing remaining items marks PO as RECEIVED', async () => {
      // Receive final 30 units
      const recRes = await request(app)
        .post(`/api/purchase-orders/${testPoId}/receive`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          receipts: [
            { poItemId: testPoItemId, quantityToReceive: 30 }
          ]
        });

      expect(recRes.status).toBe(200);
      expect(recRes.body.data.status).toBe('RECEIVED');
      expect(recRes.body.data.items[0].received_quantity).toBe(50);
      expect(recRes.body.data.items[0].remaining_quantity).toBe(0);

      // On-hand is now 25 + 30 = 55. Open PO quantity is now 0
      const invRes = await request(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${staffToken}`)
        .query({ search: 'Phase 4 Invariant Test SKU' });

      const item = invRes.body.data.find(p => p.product_id === testProductId);
      expect(item.on_hand_quantity).toBe(55);
      expect(item.open_purchase_quantity).toBe(0);
      expect(item.inventory_position).toBe(55);
    });

    test('PO cancellation cannot occur if items were already received', async () => {
      const cancelRes = await request(app)
        .post(`/api/purchase-orders/${testPoId}/cancel`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      expect(cancelRes.status).toBe(400);
    });
  });

  describe('Manual Stock Adjustments & Reorder Rule-Based Engine', () => {
    test('POST /api/inventory/adjust handles ADJUSTMENT_OUT and updates ledger', async () => {
      const adjRes = await request(app)
        .post('/api/inventory/adjust')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          productId: testProductId,
          movementType: 'ADJUSTMENT_OUT',
          quantityDelta: 5,
          notes: 'Expired batch damaged during handling'
        });

      expect(adjRes.status).toBe(200);
      expect(adjRes.body.data.newOnHand).toBe(50); // 55 - 5 = 50

      // Verify movement ledger entry
      const movRes = await request(app)
        .get('/api/inventory/movements')
        .set('Authorization', `Bearer ${staffToken}`)
        .query({ productId: testProductId, movementType: 'ADJUSTMENT_OUT' });

      expect(movRes.status).toBe(200);
      expect(movRes.body.data.length).toBeGreaterThanOrEqual(1);
      expect(movRes.body.data[0].quantity_delta).toBe(-5);
    });

    test('POST /api/inventory/adjust blocks negative stock balance', async () => {
      // Current on-hand is 50. Attempting to subtract 100 units
      const adjRes = await request(app)
        .post('/api/inventory/adjust')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          productId: testProductId,
          movementType: 'ADJUSTMENT_OUT',
          quantityDelta: 100,
          notes: 'Excessive adjustment'
        });

      expect(adjRes.status).toBe(400);
      expect(adjRes.body.error.code).toBe('NEGATIVE_STOCK_NOT_ALLOWED');
    });

    test('Staff role is blocked from stock adjustments and PO actions with 403 FORBIDDEN', async () => {
      const adjRes = await request(app)
        .post('/api/inventory/adjust')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ productId: testProductId, movementType: 'ADJUSTMENT_IN', quantityDelta: 5 });

      expect(adjRes.status).toBe(403);

      const poRes = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ supplierId: 1, items: [{ productId: testProductId, orderedQuantity: 10, unitCost: 5.0 }] });

      expect(poRes.status).toBe(403);
    });

    test('GET /api/inventory/reorder-alerts provides rule-based recommendations without ML', async () => {
      const alertsRes = await request(app)
        .get('/api/inventory/reorder-alerts')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(alertsRes.status).toBe(200);
      expect(Array.isArray(alertsRes.body.data)).toBe(true);
      // All returned items must have inventory_position <= reorder_point_threshold
      alertsRes.body.data.forEach(alert => {
        expect(alert.inventory_position).toBeLessThanOrEqual(alert.reorder_point_threshold);
        expect(alert.suggested_reorder_quantity).toBeGreaterThan(0);
        expect(alert.alert_level).toBeDefined();
      });
    });
  });
});
