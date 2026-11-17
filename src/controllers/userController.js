const userService = require('../services/userService');

class UserController {
  async listUsers(req, res, next) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const users = await userService.getAllUsers({ includeInactive });

      return res.status(200).json({
        success: true,
        count: users.length,
        data: users
      });
    } catch (err) {
      next(err);
    }
  }

  async getUser(req, res, next) {
    try {
      const user = await userService.getUserById(req.params.id);
      return res.status(200).json({
        success: true,
        data: user
      });
    } catch (err) {
      next(err);
    }
  }

  async createUser(req, res, next) {
    try {
      const created = await userService.createUser(req.body, req.user.userId);
      return res.status(201).json({
        success: true,
        message: 'User created successfully.',
        data: created
      });
    } catch (err) {
      next(err);
    }
  }

  async deactivateUser(req, res, next) {
    try {
      const deactivated = await userService.deactivateUser(req.params.id, req.user.userId);
      return res.status(200).json({
        success: true,
        message: `User with ID ${req.params.id} has been deactivated.`,
        data: deactivated
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new UserController();
