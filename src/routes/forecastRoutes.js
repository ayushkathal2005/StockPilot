/**
 * StockPilot Forecast & Replenishment Routes
 * Phase 7: REST API routes for demand forecasting and replenishment workflows.
 */

const express = require('express');
const router = express.Router();
const forecastController = require('../controllers/forecastController');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

// All routes require authentication
router.use(authenticate);

// ML Service health and readiness status
router.get('/ml-status', forecastController.getMLStatus);

// Forecast runs
router.get('/runs', forecastController.getForecastRuns);
router.get('/runs/:id', forecastController.getForecastRunById);

// Trigger forecast generation (Manager/Admin only)
router.post(
  '/generate',
  authorizeRoles('Admin', 'Manager'),
  forecastController.generateForecast
);

// Replenishment recommendations
router.get('/recommendations', forecastController.getRecommendations);
router.get('/recommendations/:id', forecastController.getRecommendationById);

// Approve recommendation -> Create PO (Manager/Admin only)
router.post(
  '/recommendations/:id/approve',
  authorizeRoles('Admin', 'Manager'),
  forecastController.approveRecommendation
);

// Reject recommendation (Manager/Admin only)
router.post(
  '/recommendations/:id/reject',
  authorizeRoles('Admin', 'Manager'),
  forecastController.rejectRecommendation
);

module.exports = router;
