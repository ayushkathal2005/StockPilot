const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.use(authenticate);

router.get('/', (req, res, next) => purchaseOrderController.getPurchaseOrders(req, res, next));
router.get('/:id', (req, res, next) => purchaseOrderController.getPurchaseOrderById(req, res, next));

// PO management restricted to Manager and Admin
router.post('/', authorizeRoles('Admin', 'Manager'), (req, res, next) => purchaseOrderController.createPurchaseOrder(req, res, next));
router.post('/:id/submit', authorizeRoles('Admin', 'Manager'), (req, res, next) => purchaseOrderController.submitPurchaseOrder(req, res, next));
router.post('/:id/receive', authorizeRoles('Admin', 'Manager'), (req, res, next) => purchaseOrderController.receiveItems(req, res, next));
router.post('/:id/cancel', authorizeRoles('Admin', 'Manager'), (req, res, next) => purchaseOrderController.cancelPurchaseOrder(req, res, next));

module.exports = router;
