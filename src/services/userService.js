const userRepository = require('../repositories/userRepository');
const auditRepository = require('../repositories/auditRepository');
const authService = require('./authService');
const { AppError } = require('../middleware/errorHandler');

class UserService {
  async getAllUsers(options) {
    return userRepository.findAll(options);
  }

  async getUserById(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError(`User with ID ${userId} not found.`, 404, 'NOT_FOUND');
    }
    return user;
  }

  async createUser({ email, password, fullName, role }, actorUserId) {
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new AppError(`A user with email '${email}' already exists.`, 409, 'DUPLICATE_EMAIL');
    }

    const passwordHash = await authService.hashPassword(password);
    const createdUser = await userRepository.create({
      email,
      passwordHash,
      fullName,
      role
    });

    await auditRepository.log({
      userId: actorUserId,
      actionType: 'USER_CREATED',
      entityName: 'Users',
      entityId: createdUser.user_id,
      details: { email, role, fullName }
    });

    return createdUser;
  }

  async deactivateUser(userId, actorUserId) {
    if (parseInt(userId, 10) === parseInt(actorUserId, 10)) {
      throw new AppError('Administrators cannot deactivate their own active account.', 400, 'CANNOT_DEACTIVATE_SELF');
    }

    const targetUser = await this.getUserById(userId);
    const updated = await userRepository.deactivate(userId);

    await auditRepository.log({
      userId: actorUserId,
      actionType: 'USER_DEACTIVATED',
      entityName: 'Users',
      entityId: userId,
      details: { email: targetUser.email }
    });

    return updated;
  }
}

module.exports = new UserService();
