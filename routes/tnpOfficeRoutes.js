const express = require('express');
const router = express.Router();
const { getTNPOfficeApplications, updateTNPOfficeStatus } = require('../controllers/tnpOfficeController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorize('TNPOffice'));

router.get('/applications', getTNPOfficeApplications);
router.put('/applications/:id/status', updateTNPOfficeStatus);

module.exports = router;
