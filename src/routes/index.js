const express = require('express');
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const categoryRoutes = require('./categoryRoutes');
const supplierRoutes = require('./supplierRoutes');
const productRoutes = require('./productRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const salesRoutes = require('./salesRoutes');
const purchaseOrderRoutes = require('./purchaseOrderRoutes');
const analyticsRoutes = require('./analyticsRoutes');

const router = express.Router();

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/categories', categoryRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/products', productRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/sales', salesRoutes);
router.use('/purchase-orders', purchaseOrderRoutes);
router.use('/analytics', analyticsRoutes);

module.exports = router;
