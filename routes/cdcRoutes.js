const express = require('express');
const router = express.Router();
const { getCDCApplications } = require('../controllers/cdcController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require authentication and CDCChairperson role
router.use(protect);
router.use(authorize('CDCChairperson'));

// Read-only endpoint - get all applications visible to CDC Chairperson
router.get('/applications', getCDCApplications);

module.exports = router;
