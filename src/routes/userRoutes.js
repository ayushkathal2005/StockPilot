const express = require('express');
const { z } = require('zod');
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');

const router = express.Router();

const createUserSchema = z.object({
  email: z.string().email('Please enter a valid email address.').trim().toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters long.'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters long.').trim(),
  role: z.enum(['Admin', 'Manager', 'Staff'], {
    errorMap: () => ({ message: "Role must be 'Admin', 'Manager', or 'Staff'." })
  })
});

// All user management routes require Admin role
router.use(authenticate);
router.use(authorizeRoles('Admin'));

router.get('/', userController.listUsers);
router.get('/:id', userController.getUser);
router.post('/', validate(createUserSchema), userController.createUser);
router.delete('/:id', userController.deactivateUser);

module.exports = router;
