const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');
const {
  sendOtp, register, forgotPassword, resetPassword, login, getMe,
  registerValidators, loginValidators, emailOnlyValidators, resetPasswordValidators,
} = require('../controllers/authController');

router.post('/send-otp', otpLimiter, emailOnlyValidators, sendOtp);
router.post('/register', authLimiter, registerValidators, register);
router.post('/activate-account', authLimiter, registerValidators, register);
router.post('/forgot-password', otpLimiter, emailOnlyValidators, forgotPassword);
router.post('/reset-password', authLimiter, resetPasswordValidators, resetPassword);
router.post('/login', authLimiter, loginValidators, login);
router.get('/me', protect, getMe);

module.exports = router;
