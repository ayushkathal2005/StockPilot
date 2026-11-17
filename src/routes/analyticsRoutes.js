const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.use(authenticate);
router.use(authorizeRoles('Admin', 'Manager'));

router.get('/executive', (req, res, next) => analyticsController.getExecutiveKPIs(req, res, next));
router.get('/sales-trends', (req, res, next) => analyticsController.getDailySalesTrends(req, res, next));
router.get('/category-performance', (req, res, next) => analyticsController.getCategoryPerformance(req, res, next));
router.get('/top-products', (req, res, next) => analyticsController.getTopProducts(req, res, next));
router.get('/supplier-performance', (req, res, next) => analyticsController.getSupplierPerformance(req, res, next));

module.exports = router;
