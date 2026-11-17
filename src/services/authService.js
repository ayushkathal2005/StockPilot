const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const userRepository = require('../repositories/userRepository');
const auditRepository = require('../repositories/auditRepository');
const { AppError } = require('../middleware/errorHandler');

class AuthService {
  /**
   * Hashes a plaintext password using bcrypt.
   */
  async hashPassword(password) {
    return bcrypt.hash(password, 10);
  }

  /**
   * Compares a plaintext password against a bcrypt hash.
   */
  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Signs a JWT token containing user identity and role.
   */
  generateToken(user) {
    return jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        role: user.role,
        fullName: user.full_name
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );
  }

  /**
   * Authenticates user with email and password credentials.
   */
  async login(email, password, clientIp = 'unknown') {
    const user = await userRepository.findByEmail(email);

    if (!user) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.is_active) {
      throw new AppError('This user account has been deactivated. Please contact an Administrator.', 403, 'ACCOUNT_DEACTIVATED');
    }

    const isMatch = await this.comparePassword(password, user.password_hash);
    if (!isMatch) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    const token = this.generateToken(user);

    // Audit log successful login
    await auditRepository.log({
      userId: user.user_id,
      actionType: 'LOGIN_SUCCESS',
      entityName: 'Users',
      entityId: user.user_id,
      details: { email: user.email, role: user.role, ip: clientIp }
    });

    return {
      token,
      user: {
        userId: user.user_id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        createdAt: user.created_at
      }
    };
  }
}

module.exports = new AuthService();
