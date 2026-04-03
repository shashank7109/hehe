const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getDepartments, createDepartment,
  getRoutingConfigs, createOrUpdateRoutingConfig,
  getUsers, assignRole, resendInvite, deleteUser
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Reusable inline validation error handler
const { validationResult } = require('express-validator');
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

router.use(protect);
router.use(authorize('Admin'));

router.route('/departments')
  .get(getDepartments)
  .post(
    body('name').trim().notEmpty().withMessage('Department name is required'),
    body('code').trim().notEmpty().toUpperCase().withMessage('Department code is required'),
    validate,
    createDepartment
  );

router.route('/routing')
  .get(getRoutingConfigs)
  .post(
    body('departmentId').notEmpty().withMessage('Department ID is required'),
    body('primaryApproverEmail').isEmail().normalizeEmail().withMessage('Valid approver email is required'),
    body('roleType').isIn(['tnp_coordinator', 'hod']).withMessage('roleType must be tnp_coordinator or hod'),
    validate,
    createOrUpdateRoutingConfig
  );

router.route('/users').get(getUsers);

router.route('/users/assign-role').put(
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('role').isIn(['Student', 'DeptOfficer', 'TNPHead', 'TNPOffice', 'Admin']).withMessage('Invalid role'),
  validate,
  assignRole
);

router.route('/users/resend-invite').post(
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  validate,
  resendInvite
);

router.route('/users/:id').delete(deleteUser);

module.exports = router;
