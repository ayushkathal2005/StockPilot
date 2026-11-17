const express = require('express');
const { z } = require('zod');
const productController = require('../controllers/productController');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');

const router = express.Router();

const createProductSchema = z.object({
  sku: z.string().min(2, 'SKU must be at least 2 characters.').max(50).trim().toUpperCase(),
  productName: z.string().min(2, 'Product name must be at least 2 characters.').max(200).trim(),
  categoryId: z.number().int().positive('Valid category ID required.'),
  preferredSupplierId: z.number().int().positive().optional().nullable(),
  costPrice: z.number().min(0, 'Cost price must be non-negative.'),
  sellingPrice: z.number().min(0, 'Selling price must be non-negative.'),
  reorderPointThreshold: z.number().int().min(0).default(10),
  targetSafetyStock: z.number().int().min(0).default(15),
  leadTimeDays: z.number().int().min(0).default(7),
  initialStock: z.number().int().min(0).default(0)
});

router.use(authenticate);

router.get('/', productController.listProducts);
router.get('/:id', productController.getProduct);

router.post('/', authorizeRoles('Admin', 'Manager'), validate(createProductSchema), productController.createProduct);
router.put('/:id', authorizeRoles('Admin', 'Manager'), productController.updateProduct);
router.delete('/:id', authorizeRoles('Admin', 'Manager'), productController.deactivateProduct);

module.exports = router;
