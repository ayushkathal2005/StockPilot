const request = require('supertest');
const app = require('../../src/app');
const { closeDB } = require('../../src/config/database');

describe('Integration Tests: GET /api/health', () => {
  afterAll(async () => {
    await closeDB();
  });

  test('returns 200 OK and reports app and database status', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.status).toBe('UP');
    expect(res.body.data.database).toBeDefined();
    expect(res.body.data.database.status).toBe('UP');
    expect(res.body.data.database.database).toBe('StockPilotDB');
    expect(res.body.data.database.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
