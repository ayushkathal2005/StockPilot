const express = require('express');
const { z } = require('zod');
const categoryController = require('../controllers/categoryController');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');

const router = express.Router();

const categorySchema = z.object({
  categoryName: z.string().min(2, 'Category name must be at least 2 characters long.').trim(),
  description: z.string().max(500).optional().nullable()
});

router.use(authenticate);

// Read endpoints accessible to all authenticated roles
router.get('/', categoryController.listCategories);
router.get('/:id', categoryController.getCategory);

// Write endpoints restricted to Manager and Admin
router.post('/', authorizeRoles('Admin', 'Manager'), validate(categorySchema), categoryController.createCategory);
router.put('/:id', authorizeRoles('Admin', 'Manager'), categoryController.updateCategory);

module.exports = router;
