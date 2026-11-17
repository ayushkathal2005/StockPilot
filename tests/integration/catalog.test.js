const request = require('supertest');
const app = require('../../src/app');
const { closeDB } = require('../../src/config/database');

describe('Integration Tests: Catalog & Inventory Management APIs', () => {
  let adminToken = '';
  let managerToken = '';
  let staffToken = '';
  let createdCategoryId = null;
  let createdSupplierId = null;
  let createdProductId = null;

  beforeAll(async () => {
    // 1. Authenticate seeded users to acquire role tokens
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@stockpilot.io', password: 'Password123!' });
    adminToken = adminRes.body.data.token;

    const managerRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@stockpilot.io', password: 'Password123!' });
    managerToken = managerRes.body.data.token;

    const staffRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'staff@stockpilot.io', password: 'Password123!' });
    staffToken = staffRes.body.data.token;
  });

  afterAll(async () => {
    await closeDB();
  });

  // ============================================================================
  // Categories Tests
  // ============================================================================
  describe('Categories Management', () => {
    test('GET /api/categories returns seeded categories', async () => {
      const res = await request(app)
        .get('/api/categories')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(5);
    });

    test('POST /api/categories creates a new category (Manager/Admin)', async () => {
      const uniqueCatName = `Test Category ${Date.now()}`;
      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          categoryName: uniqueCatName,
          description: 'Category for automated test verification'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.category_name).toBe(uniqueCatName);
      createdCategoryId = res.body.data.category_id;
    });

    test('POST /api/categories blocks duplicate category name with 409', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          categoryName: 'Beverages',
          description: 'Duplicate name'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DUPLICATE_CATEGORY');
    });

    test('POST /api/categories blocks Staff role with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          categoryName: 'Staff Unauthorized Cat'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ============================================================================
  // Suppliers Tests
  // ============================================================================
  describe('Suppliers Management', () => {
    test('GET /api/suppliers returns seeded suppliers', async () => {
      const res = await request(app)
        .get('/api/suppliers')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(5);
    });

    test('POST /api/suppliers creates a new supplier (Manager/Admin)', async () => {
      const uniqueSupName = `Test Supplier ${Date.now()}`;
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          supplierName: uniqueSupName,
          contactEmail: 'supplier@test.com',
          contactPhone: '+1-555-0100',
          address: '123 Supply Way',
          defaultLeadTimeDays: 5
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.supplier_name).toBe(uniqueSupName);
      createdSupplierId = res.body.data.supplier_id;
    });

    test('POST /api/suppliers blocks Staff role with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          supplierName: 'Staff Unauthorized Supplier'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ============================================================================
  // Products Tests
  // ============================================================================
  describe('Products & Inventory Management', () => {
    test('GET /api/products returns products catalog with stock balances', async () => {
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(35);

      const firstProd = res.body.data[0];
      expect(firstProd.sku).toBeDefined();
      expect(firstProd.on_hand_quantity).toBeDefined();
      expect(firstProd.available_quantity).toBeDefined();
      expect(firstProd.stock_health_status).toBeDefined();
    });

    test('GET /api/products filters by search term', async () => {
      const res = await request(app)
        .get('/api/products?search=cola')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach(p => {
        const matches = p.sku.toLowerCase().includes('cola') || p.product_name.toLowerCase().includes('cola');
        expect(matches).toBe(true);
      });
    });

    test('POST /api/products creates product, initializes inventory, and records stock movement', async () => {
      const uniqueSku = `TEST-SKU-${Date.now()}`;
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          sku: uniqueSku,
          productName: 'Automated Test Product',
          categoryId: createdCategoryId || 1,
          preferredSupplierId: createdSupplierId || 1,
          costPrice: 5.50,
          sellingPrice: 12.99,
          reorderPointThreshold: 10,
          targetSafetyStock: 15,
          leadTimeDays: 5,
          initialStock: 25
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sku).toBe(uniqueSku);
      expect(res.body.data.on_hand_quantity).toBe(25);
      expect(res.body.data.available_quantity).toBe(25);
      createdProductId = res.body.data.product_id;
    });

    test('POST /api/products rejects duplicate SKU with 409 DUPLICATE_SKU', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sku: 'BEV-COLA-330',
          productName: 'Duplicate SKU Product',
          categoryId: 1,
          costPrice: 5.00,
          sellingPrice: 10.00
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_SKU');
    });

    test('POST /api/products rejects negative selling price with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sku: `NEG-${Date.now()}`,
          productName: 'Negative Price Product',
          categoryId: 1,
          costPrice: 5.00,
          sellingPrice: -10.00
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('POST /api/products rejects non-existent category with 400 INVALID_CATEGORY', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sku: `BAD-CAT-${Date.now()}`,
          productName: 'Invalid Category Product',
          categoryId: 999999,
          costPrice: 5.00,
          sellingPrice: 10.00
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CATEGORY');
    });

    test('POST /api/products blocks Staff role with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          sku: `STAFF-${Date.now()}`,
          productName: 'Staff Product',
          categoryId: 1,
          costPrice: 5.00,
          sellingPrice: 10.00
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('PUT /api/products/:id updates product details', async () => {
      const res = await request(app)
        .put(`/api/products/${createdProductId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          productName: 'Updated Automated Test Product',
          sellingPrice: 14.50
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product_name).toBe('Updated Automated Test Product');
      expect(parseFloat(res.body.data.selling_price)).toBe(14.50);
    });

    test('DELETE /api/products/:id soft-deactivates product', async () => {
      const res = await request(app)
        .delete(`/api/products/${createdProductId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify omitted from active catalog
      const listRes = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${staffToken}`);

      const found = listRes.body.data.find(p => p.product_id === createdProductId);
      expect(found).toBeUndefined();
    });
  });
});
