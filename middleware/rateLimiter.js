const rateLimit = require('express-rate-limit');

// Global limiter — loose cap on all routes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP, please try again after 15 minutes.' }
});

// Auth limiter — for login, register, reset-password
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Please wait 15 minutes and try again.' }
});

// OTP limiter — strict cap to prevent email abuse
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many OTP requests. Please wait 10 minutes before requesting again.' }
});

module.exports = { globalLimiter, authLimiter, otpLimiter };
