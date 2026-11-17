const { AppError } = require('./errorHandler');

/**
 * Role-Based Access Control (RBAC) middleware generator.
 * @param  {...string} allowedRoles - List of permitted roles (e.g. 'Admin', 'Manager')
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required prior to role authorization.', 401, 'UNAUTHORIZED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(
        `Forbidden. Access requires one of the following roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}.`,
        403,
        'FORBIDDEN'
      ));
    }

    next();
  };
}

module.exports = {
  authorizeRoles
};
