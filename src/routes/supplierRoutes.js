const express = require('express');
const { z } = require('zod');
const supplierController = require('../controllers/supplierController');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');

const router = express.Router();

const supplierSchema = z.object({
  supplierName: z.string().min(2, 'Supplier name must be at least 2 characters long.').trim(),
  contactEmail: z.string().email('Invalid email address format.').optional().nullable(),
  contactPhone: z.string().max(50).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  defaultLeadTimeDays: z.number().int().min(0, 'Lead time must be non-negative.').default(7)
});

router.use(authenticate);

router.get('/', supplierController.listSuppliers);
router.get('/:id', supplierController.getSupplier);

router.post('/', authorizeRoles('Admin', 'Manager'), validate(supplierSchema), supplierController.createSupplier);
router.put('/:id', authorizeRoles('Admin', 'Manager'), supplierController.updateSupplier);

module.exports = router;
