const express = require('express');
const router = express.Router();
const { getOfficerApplications, updateApplicationStatus } = require('../controllers/officerController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorize('DeptOfficer', 'TNPHead'));

router.get('/applications', getOfficerApplications);
router.put('/applications/:id/status', updateApplicationStatus);

module.exports = router;
