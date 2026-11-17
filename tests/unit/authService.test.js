const authService = require('../../src/services/authService');
const jwt = require('jsonwebtoken');
const config = require('../../src/config/env');

describe('Unit Tests: AuthService', () => {
  const samplePassword = 'StrongPassword123!';

  test('hashPassword() generates a valid bcrypt hash', async () => {
    const hash = await authService.hashPassword(samplePassword);
    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);
  });

  test('comparePassword() returns true for matching password and false otherwise', async () => {
    const hash = await authService.hashPassword(samplePassword);
    const isMatch = await authService.comparePassword(samplePassword, hash);
    expect(isMatch).toBe(true);

    const isWrong = await authService.comparePassword('WrongPassword!', hash);
    expect(isWrong).toBe(false);
  });

  test('generateToken() produces a valid JWT decoded with config secret', () => {
    const mockUser = {
      user_id: 42,
      email: 'tester@stockpilot.io',
      role: 'Manager',
      full_name: 'Test Manager'
    };

    const token = authService.generateToken(mockUser);
    expect(token).toBeDefined();

    const decoded = jwt.verify(token, config.jwtSecret);
    expect(decoded.userId).toBe(42);
    expect(decoded.email).toBe('tester@stockpilot.io');
    expect(decoded.role).toBe('Manager');
    expect(decoded.fullName).toBe('Test Manager');
  });
});
