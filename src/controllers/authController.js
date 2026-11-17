const authService = require('../services/authService');

/**
 * Controller for user authentication endpoints.
 */
class AuthController {
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      const { token, user } = await authService.login(email, password, clientIp);

      // Set secure HTTP-only cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000 // 8 hours
      });

      return res.status(200).json({
        success: true,
        message: 'Authentication successful.',
        data: {
          token,
          user
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res) {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.'
    });
  }

  async getMe(req, res) {
    return res.status(200).json({
      success: true,
      data: {
        user: req.user
      }
    });
  }
}

module.exports = new AuthController();
