const request = require('supertest');
const app = require('../../src/app');
const { closeDB } = require('../../src/config/database');

describe('Integration Tests: RBAC Authorization & User Management', () => {
  let adminToken = '';
  let managerToken = '';
  let staffToken = '';

  beforeAll(async () => {
    // 1. Get Admin Token
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@stockpilot.io', password: 'Password123!' });
    adminToken = adminRes.body.data.token;

    // 2. Get Manager Token
    const managerRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@stockpilot.io', password: 'Password123!' });
    managerToken = managerRes.body.data.token;

    // 3. Get Staff Token
    const staffRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'staff@stockpilot.io', password: 'Password123!' });
    staffToken = staffRes.body.data.token;
  });

  afterAll(async () => {
    await closeDB();
  });

  test('Staff user is blocked from GET /api/users with 403 FORBIDDEN', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('Manager user is blocked from GET /api/users with 403 FORBIDDEN', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('Admin user is permitted to GET /api/users with 200 OK', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
  });

  test('Admin user can create, query, and deactivate a new user', async () => {
    const uniqueEmail = `testuser_${Date.now()}@stockpilot.io`;

    // 1. Create User
    const createRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: uniqueEmail,
        password: 'NewUserPassword123!',
        fullName: 'Automated Test User',
        role: 'Staff'
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    const createdUserId = createRes.body.data.user_id;
    expect(createdUserId).toBeDefined();

    // 2. Query Created User by ID
    const getRes = await request(app)
      .get(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.email).toBe(uniqueEmail);

    // 3. Deactivate User
    const deleteRes = await request(app)
      .delete(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
    expect(deleteRes.body.data.is_active).toBe(false);

    // 4. Attempt login with deactivated user should fail with 403
    const deactivatedLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: uniqueEmail,
        password: 'NewUserPassword123!'
      });

    expect(deactivatedLoginRes.status).toBe(403);
    expect(deactivatedLoginRes.body.error.code).toBe('ACCOUNT_DEACTIVATED');
  });

  test('Admin creating user with existing email fails with 409 DUPLICATE_EMAIL', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'admin@stockpilot.io',
        password: 'SomePassword123!',
        fullName: 'Another Admin',
        role: 'Admin'
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DUPLICATE_EMAIL');
  });

  test('Admin cannot deactivate their own active account with 400', async () => {
    // Admin user id is 1
    const res = await request(app)
      .delete('/api/users/1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CANNOT_DEACTIVATE_SELF');
  });
});
