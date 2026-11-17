const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', (req, res, next) => salesController.getSales(req, res, next));
router.get('/:id', (req, res, next) => salesController.getSaleById(req, res, next));

// All authenticated roles (Staff, Manager, Admin) can record sales
router.post('/', (req, res, next) => salesController.createSale(req, res, next));

module.exports = router;
