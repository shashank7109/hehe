const express = require('express');
const router = express.Router();
const { submitApplication, getMyApplications, getApplicationLogs } = require('../controllers/studentController');
const upload = require('../middleware/uploadMiddleware');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getDepartments } = require('../controllers/adminController');

router.use(protect);
router.use(authorize('Student'));

router.post('/apply', upload.fields([
  { name: 'offerLetter', maxCount: 1 },
  { name: 'statementOfObjective', maxCount: 1 },
  { name: 'mandatoryDocument', maxCount: 1 },
  { name: 'nocFormat', maxCount: 1 }
]), submitApplication);
router.get('/applications', getMyApplications);
router.get('/applications/:id/logs', getApplicationLogs);
router.get('/departments', getDepartments);

module.exports = router;
