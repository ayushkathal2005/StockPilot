const request = require('supertest');
const app = require('../../src/app');
const { closeDB } = require('../../src/config/database');

describe('Integration Tests: Authentication Endpoints', () => {
  afterAll(async () => {
    await closeDB();
  });

  test('POST /api/auth/login successfully authenticates valid seeded admin', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@stockpilot.io',
        password: 'Password123!'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe('admin@stockpilot.io');
    expect(res.body.data.user.role).toBe('Admin');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  test('POST /api/auth/login rejects invalid password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@stockpilot.io',
        password: 'WrongPassword!'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('POST /api/auth/login rejects non-existent email with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@stockpilot.io',
        password: 'Password123!'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('POST /api/auth/login rejects invalid email format with 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'not-an-email',
        password: 'Password123!'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('GET /api/auth/me returns authenticated user with valid token', async () => {
    // 1. Log in to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'manager@stockpilot.io',
        password: 'Password123!'
      });

    const token = loginRes.body.data.token;

    // 2. Query /api/auth/me
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.user.email).toBe('manager@stockpilot.io');
    expect(meRes.body.data.user.role).toBe('Manager');
  });

  test('GET /api/auth/me rejects request without token with 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('POST /api/auth/logout clears token cookie', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@stockpilot.io',
        password: 'Password123!'
      });

    const token = loginRes.body.data.token;

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);
  });
});
