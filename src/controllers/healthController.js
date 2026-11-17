const { checkDatabaseHealth } = require('../config/database');
const config = require('../config/env');
const pkg = require('../../package.json');

/**
 * Controller for application health and readiness checks.
 */
async function getHealth(req, res) {
  const dbHealth = await checkDatabaseHealth();
  const isHealthy = dbHealth.status === 'UP';

  const healthData = {
    status: isHealthy ? 'UP' : 'DEGRADED',
    app: {
      name: pkg.name,
      version: pkg.version,
      environment: config.env,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    },
    database: dbHealth,
    system: {
      memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      nodeVersion: process.version
    }
  };

  const statusCode = isHealthy ? 200 : 503;
  return res.status(statusCode).json({
    success: isHealthy,
    data: healthData
  });
}

module.exports = {
  getHealth
};
