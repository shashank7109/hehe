const Application = require('../models/Application');
const ApplicationLog = require('../models/ApplicationLog');
const RoutingConfig = require('../models/RoutingConfig');
const { enqueueEmail } = require('../utils/emailQueue');
const logger = require('../utils/logger');

const submitApplication = async (req, res) => {
  try {
    const {
      departmentId, rollNumber, degreeCourse, branch, currentYear, yearSession, latestCPI, contactNo,
      internshipType, durationFrom, durationTo, companyName, organizationAddress,
      mentorName, mentorDesignation, mentorContact, mentorEmail,
      addresseeName, addresseeDesignation, addresseeContact, addresseeEmail,
      studentMessage
    } = req.body;

    const offerLetter = req.files?.['offerLetter']?.[0] ? `uploads/${req.files['offerLetter'][0].filename}` : null;
    const statementOfObjective = req.files?.['statementOfObjective']?.[0] ? `uploads/${req.files['statementOfObjective'][0].filename}` : null;
    const mandatoryDocument = req.files?.['mandatoryDocument']?.[0] ? `uploads/${req.files['mandatoryDocument'][0].filename}` : null;
    const nocFormat = req.files?.['nocFormat']?.[0] ? `uploads/${req.files['nocFormat'][0].filename}` : null;

    const marksheet = req.files?.['marksheet']?.[0]
      ? `uploads/${req.files['marksheet'][0].filename}`
      : null;

    const sopText = (req.body.sopText || '').trim();
    const otherInternshipDescription =
      req.body.internshipType === 'Other'
        ? (req.body.otherInternshipDescription || '').trim()
        : '';

    if (!marksheet) {
      return res.status(400).json({ message: 'Previous semester marksheet PDF is required.' });
    }
    if (!sopText) {
      return res.status(400).json({ message: 'Statement of Purpose is required.' });
    }

    // Check for duplicate active applications
    const exist = await Application.findOne({
      studentId: req.user._id,
      companyName,
      status: { $in: ['SUBMITTED', 'UNDER_REVIEW_DEPT', 'UNDER_REVIEW_HEAD', 'READY_FOR_COLLECTION'] }
    });
    if (exist) {
      return res.status(400).json({ message: 'Application for this company is already active or approved.' });
    }

    // Create with correct initial status (no silent mutation after creation)
    const application = await Application.create({
      studentId: req.user._id,
      departmentId, rollNumber, degreeCourse, branch, currentYear, yearSession, latestCPI, contactNo,
      internshipType, durationFrom, durationTo, companyName, organizationAddress,
      mentorName, mentorDesignation, mentorContact, mentorEmail,
      addresseeName, addresseeDesignation, addresseeContact, addresseeEmail,
      status: 'UNDER_REVIEW_DEPT', // correct status from the start
      offerLetter, statementOfObjective, mandatoryDocument, marksheet, nocFormat,
      sopText, otherInternshipDescription, studentMessage
    });

    await ApplicationLog.create({
      applicationId: application._id,
      actionBy: req.user._id,
      role: 'Student',
      action: 'Submitted Application',
      timestamp: new Date()
    });

    // Notify officer via routing config (fire-and-forget)
    const routing = await RoutingConfig.findOne({ departmentId });
    if (routing?.primaryApproverEmail) {
      enqueueEmail({
        to: routing.primaryApproverEmail,
        subject: 'New NOC Application Submitted',
        text: `A new NOC application for ${companyName} has been submitted by ${req.user.name}.`,
      });
    }

    logger.info(`New application submitted by ${req.user.name} (Student ID: ${req.user._id}) for ${companyName}`);
    res.status(201).json(application);
  } catch (error) {
    logger.error(`Application Submit Error: ${error.stack}`);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

const getMyApplications = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const [applications, total] = await Promise.all([
      Application.find({ studentId: req.user._id })
        .populate('departmentId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Application.countDocuments({ studentId: req.user._id })
    ]);
    res.json({ applications, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getApplicationLogs = async (req, res) => {
  try {
    const logs = await ApplicationLog.find({ applicationId: req.params.id })
      .populate('actionBy', 'name role')
      .sort({ createdAt: 1 });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { submitApplication, getMyApplications, getApplicationLogs };
