const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { enqueueEmail } = require('../utils/emailQueue');
const generateToken = require('../utils/generateToken');
const { getCache, setCache, delCache } = require('../utils/redis');

// bcrypt rounds defined once — change here to affect all hashing
const SALT_ROUNDS = 12;

// Reusable validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Exported validators for use in routes
const registerValidators = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be a 6-digit number'),
  handleValidationErrors,
];

const loginValidators = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors,
];

const emailOnlyValidators = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  handleValidationErrors,
];

const resetPasswordValidators = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Invalid OTP'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  handleValidationErrors,
];

// --- Controllers ---

const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email.endsWith('@rgipt.ac.in')) {
      return res.status(400).json({ message: 'Only @rgipt.ac.in email addresses are allowed' });
    }

    const userExists = await User.findOne({ email });
    if (userExists && userExists.password !== 'PENDING_USER_NO_PASSWORD') {
      return res.status(400).json({ message: 'User already exists' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await OTP.findOneAndDelete({ email });
    await OTP.create({ email, otp: otpCode });

    enqueueEmail({
      to: email,
      subject: 'NOC Portal - Verification Code',
      text: `Your verification code is ${otpCode}. It will expire in 5 minutes.`,
    });

    res.json({ message: 'OTP sent to email successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const register = async (req, res) => {
  try {
    const { name, email, password, otp } = req.body;

    if (!email.endsWith('@rgipt.ac.in')) {
      return res.status(400).json({ message: 'Only @rgipt.ac.in email addresses are allowed' });
    }

    let cachedOtp = await getCache(`otp:${email}`);
    let isValid = (cachedOtp === otp);

    if (!cachedOtp) {
      const dbOtp = await OTP.findOne({ email, otp });
      if (dbOtp) isValid = true;
    }

    if (!isValid) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    let user = await User.findOne({ email });
    if (user && user.password !== 'PENDING_USER_NO_PASSWORD') {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    if (user) {
      user.name = name;
      user.password = hashedPassword;
      await user.save();
    } else {
      user = await User.create({ name, email, password: hashedPassword, role: 'Student' });
    }

    await delCache(`otp:${email}`);
    await delCache(`user:${user._id}`);
    OTP.findOneAndDelete({ email }).catch(() => { });

    res.status(201).json({
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always return 200 — do not reveal whether the email is registered (prevents user enumeration)
    if (!user) {
      return res.json({ message: 'If this email is registered, a reset code has been sent.' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await OTP.findOneAndDelete({ email });
    await OTP.create({ email, otp: otpCode });

    enqueueEmail({
      to: email,
      subject: 'NOC Portal - Password Reset Code',
      text: `Your password reset code is ${otpCode}. It will expire in 5 minutes.`,
    });

    res.json({ message: 'If this email is registered, a reset code has been sent.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    let cachedOtp = await getCache(`otp:${email}`);
    let isValid = (cachedOtp === otp);

    if (!cachedOtp) {
      const dbOtp = await OTP.findOne({ email, otp });
      if (dbOtp) isValid = true;
    }

    if (!isValid) return res.status(400).json({ message: 'Invalid or expired OTP' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await user.save();

    await delCache(`otp:${email}`);
    await delCache(`user:${user._id}`);
    OTP.findOneAndDelete({ email }).catch(() => { });
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).populate('departmentId', 'name code');
    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.departmentId,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getMe = async (req, res) => {
  try {
    const cacheKey = `user:${req.user.id}`;
    let user = await getCache(cacheKey);

    if (!user) {
      user = await User.findById(req.user.id).select('-password').populate('departmentId', 'name code');
      if (user) await setCache(cacheKey, user, 300);
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  sendOtp,
  register,
  forgotPassword,
  resetPassword,
  login,
  getMe,
  registerValidators,
  loginValidators,
  emailOnlyValidators,
  resetPasswordValidators,
};
