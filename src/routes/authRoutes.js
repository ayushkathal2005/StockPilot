const express = require('express');
const { z } = require('zod');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address.').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required.')
});

router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
