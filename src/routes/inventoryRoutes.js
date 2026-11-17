const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.use(authenticate);

router.get('/', (req, res, next) => inventoryController.getInventory(req, res, next));
router.get('/movements', (req, res, next) => inventoryController.getMovements(req, res, next));
router.get('/reorder-alerts', (req, res, next) => inventoryController.getReorderAlerts(req, res, next));

// Stock adjustment restricted to Manager and Admin
router.post('/adjust', authorizeRoles('Admin', 'Manager'), (req, res, next) => inventoryController.adjustStock(req, res, next));

module.exports = router;
