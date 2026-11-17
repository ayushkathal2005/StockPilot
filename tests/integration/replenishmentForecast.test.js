/**
 * StockPilot Integration Tests - Phase 7 Demand Forecasting & Replenishment Workflows
 * Verifies ML integration, horizon validation, mathematical inventory invariants,
 * RBAC enforcement, and manager approval Purchase Order creation.
 */

const request = require('supertest');
const app = require('../../src/app');
const { connectDB, getPool, closeDB, sql } = require('../../src/config/database');
const mlClient = require('../../src/services/mlClient');

describe('Integration Tests: Phase 7 Demand Forecasting & Replenishment', () => {
  let adminToken;
  let managerToken;
  let staffToken;
  let pool;
  let testProductId;
  let testSupplierId;

  beforeAll(async () => {
    await connectDB();
    pool = await getPool();

    // Authenticate Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@stockpilot.io', password: 'Password123!' });
    adminToken = adminRes.body.data.token;

    // Authenticate Manager
    const managerRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@stockpilot.io', password: 'Password123!' });
    managerToken = managerRes.body.data.token;

    // Authenticate Staff
    const staffRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'staff@stockpilot.io', password: 'Password123!' });
    staffToken = staffRes.body.data.token;

    // Get an active product and preferred supplier
    const prodRes = await pool.request().query(`
      SELECT TOP 1 product_id, preferred_supplier_id 
      FROM dbo.Products 
      WHERE is_active = 1 AND preferred_supplier_id IS NOT NULL;
    `);
    testProductId = prodRes.recordset[0].product_id;
    testSupplierId = prodRes.recordset[0].preferred_supplier_id;
  });

  afterAll(async () => {
    await closeDB();
  });

  describe('ML Service Health & Status Probe', () => {
    it('GET /api/forecast/ml-status returns status object without crashing', async () => {
      const res = await request(app)
        .get('/api/forecast/ml-status')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('isAvailable');
      expect(res.body.data).toHaveProperty('health');
    });
  });

  describe('Horizon Validation & RBAC Controls', () => {
    it('Staff is blocked from triggering forecast generation with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/forecast/generate')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ horizonDays: 14 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('POST /api/forecast/generate rejects horizon < 7 with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/forecast/generate')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ horizonDays: 5 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_HORIZON');
    });

    it('POST /api/forecast/generate rejects horizon > 30 with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/forecast/generate')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ horizonDays: 45 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_HORIZON');
    });
  });

  describe('Forecast Generation & Replenishment Logic', () => {
    let createdRunId;
    let pendingRecommendation;

    it('POST /api/forecast/generate successfully runs and calculates replenishment recommendations', async () => {
      const res = await request(app)
        .post('/api/forecast/generate')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ horizonDays: 14 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data).toHaveProperty('runId');
      expect(data).toHaveProperty('modelVersion');
      expect(data).toHaveProperty('recommendations');
      expect(data.recommendations.length).toBeGreaterThan(0);

      createdRunId = data.runId;
      pendingRecommendation = data.recommendations.find(r => r.suggestedQuantity > 0) || data.recommendations[0];

      // Invariant verification on recommendations
      for (const rec of data.recommendations) {
        expect(rec.suggestedQuantity).toBeGreaterThanOrEqual(0);
        expect(rec.safetyStock).toBeGreaterThanOrEqual(5);
        expect(rec.targetStock).toBeGreaterThanOrEqual(rec.safetyStock);
        expect(rec.inventoryPosition).toBe(rec.currentOnHand + rec.openPurchaseQuantity);
      }
    });

    it('GET /api/forecast/runs lists the newly created run', async () => {
      const res = await request(app)
        .get('/api/forecast/runs')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const found = res.body.data.find(r => r.run_id === createdRunId);
      expect(found).toBeDefined();
      expect(found.horizon_days).toBe(14);
    });

    it('GET /api/forecast/recommendations lists pending recommendations', async () => {
      const res = await request(app)
        .get('/api/forecast/recommendations?status=PENDING')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('Staff is blocked from approving recommendations with 403 FORBIDDEN', async () => {
      const recId = (pendingRecommendation && (pendingRecommendation.recommendationId || pendingRecommendation.recommendation_id)) || 1;
      const res = await request(app)
        .post(`/api/forecast/recommendations/${recId}/approve`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
    });

    it('POST /api/forecast/recommendations/:id/approve creates a Purchase Order upon Manager approval', async () => {
      // Find a recommendation with suggestedQuantity > 0 for testing PO creation
      // If none has suggestedQuantity > 0, insert a test recommendation
      let targetRecId;
      const recsRes = await pool.request().query(`
        SELECT TOP 1 recommendation_id, product_id, suggested_quantity 
        FROM dbo.ReplenishmentRecommendations 
        WHERE status = 'PENDING' AND suggested_quantity > 0;
      `);

      if (recsRes.recordset.length > 0) {
        targetRecId = recsRes.recordset[0].recommendation_id;
      } else {
        // Insert an artificial test recommendation with quantity 20
        const insertRes = await pool.request()
          .input('pid', sql.Int, testProductId)
          .input('qty', sql.Int, 25)
          .query(`
            INSERT INTO dbo.ReplenishmentRecommendations (
              product_id, current_on_hand, open_purchase_quantity, inventory_position,
              lead_time_demand, target_horizon_demand, safety_stock, target_stock,
              suggested_quantity, recommendation_source, status
            )
            OUTPUT INSERTED.recommendation_id
            VALUES (@pid, 5, 0, 5, 20.0, 50.0, 10.0, 60.0, @qty, 'xgboost', 'PENDING');
          `);
        targetRecId = insertRes.recordset[0].recommendation_id;
      }

      const approveRes = await request(app)
        .post(`/api/forecast/recommendations/${targetRecId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.success).toBe(true);
      expect(approveRes.body.data.status).toBe('APPROVED_TO_PO');
      expect(approveRes.body.data.purchaseOrder).toBeDefined();
      expect(approveRes.body.data.purchaseOrder.status).toBe('SUBMITTED');

      // Verify in DB that status is APPROVED_TO_PO
      const dbCheck = await pool.request()
        .input('id', sql.Int, targetRecId)
        .query('SELECT status FROM dbo.ReplenishmentRecommendations WHERE recommendation_id = @id');
      expect(dbCheck.recordset[0].status).toBe('APPROVED_TO_PO');

      // Attempting to re-approve the same recommendation must fail with 400
      const repeatRes = await request(app)
        .post(`/api/forecast/recommendations/${targetRecId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(repeatRes.status).toBe(400);
      expect(repeatRes.body.error.code).toBe('INVALID_RECOMMENDATION_STATE');
    });

    it('POST /api/forecast/recommendations/:id/reject marks recommendation as REJECTED', async () => {
      // Create a pending recommendation to reject
      const insertRes = await pool.request()
        .input('pid', sql.Int, testProductId)
        .query(`
          INSERT INTO dbo.ReplenishmentRecommendations (
            product_id, current_on_hand, open_purchase_quantity, inventory_position,
            lead_time_demand, target_horizon_demand, safety_stock, target_stock,
            suggested_quantity, recommendation_source, status
          )
          OUTPUT INSERTED.recommendation_id
          VALUES (@pid, 10, 0, 10, 15.0, 35.0, 5.0, 40.0, 30, 'xgboost', 'PENDING');
        `);
      const recId = insertRes.recordset[0].recommendation_id;

      const rejectRes = await request(app)
        .post(`/api/forecast/recommendations/${recId}/reject`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ reason: 'Overstocked from local vendor' });

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.data.status).toBe('REJECTED');

      const check = await pool.request()
        .input('id', sql.Int, recId)
        .query('SELECT status FROM dbo.ReplenishmentRecommendations WHERE recommendation_id = @id');
      expect(check.recordset[0].status).toBe('REJECTED');
    });

    it('Graceful Fallback: service completes with rule_based_fallback when ML service is offline', async () => {
      // Temporarily mock mlClient.generateForecast to simulate ML service failure
      const originalMethod = mlClient.generateForecast;
      mlClient.generateForecast = async () => ({
        ok: false,
        error: 'Simulated connection refused ECONNREFUSED 127.0.0.1:8000',
        isOffline: true
      });

      try {
        const res = await request(app)
          .post('/api/forecast/generate')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ horizonDays: 14 });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.modelVersion).toBe('rule_based_fallback');
        expect(res.body.data.isMlAvailable).toBe(false);
        expect(res.body.data.recommendations.length).toBeGreaterThan(0);
        expect(res.body.data.recommendations[0].recommendationSource).toBe('rule_based_fallback');
      } finally {
        mlClient.generateForecast = originalMethod;
      }
    });

    it('ML Forecast Persistence: persists daily forecasts and tags source as xgboost when ML is active', async () => {
      const originalGenerate = mlClient.generateForecast;
      mlClient.generateForecast = async () => ({
        ok: true,
        data: {
          model_version: 'v1.0.0',
          horizon_days: 14,
          products_count: 1,
          total_forecast_units: 350.0,
          forecasts: [
            {
              product_id: testProductId,
              sku: 'BEV-TEST',
              forecast_source: 'xgboost',
              lead_time_days: 5,
              lead_time_demand: 125.0,
              total_horizon_demand: 350.0,
              daily_predictions: Array.from({ length: 14 }, (_, i) => ({
                forecast_date: `2026-07-${String(i + 1).padStart(2, '0')}`,
                predicted_units: 25.0
              }))
            }
          ]
        }
      });

      try {
        const res = await request(app)
          .post('/api/forecast/generate')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ horizonDays: 14 });

        expect(res.status).toBe(201);
        expect(res.body.data.modelVersion).toBe('v1.0.0');
        expect(res.body.data.forecastSource).toBe('xgboost');

        const runId = res.body.data.runId;
        // Verify in DB that DemandForecasts contains 14 rows for this run
        const dfCheck = await pool.request()
          .input('runId', sql.Int, runId)
          .query('SELECT COUNT(*) as count, forecast_source FROM dbo.DemandForecasts WHERE run_id = @runId GROUP BY forecast_source');
        expect(dfCheck.recordset.length).toBeGreaterThan(0);
        expect(dfCheck.recordset[0].count).toBe(14);
        expect(dfCheck.recordset[0].forecast_source).toBe('xgboost');
      } finally {
        mlClient.generateForecast = originalGenerate;
      }
    });
  });
});
