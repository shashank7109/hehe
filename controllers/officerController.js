const Application = require('../models/Application');
const ApplicationLog = require('../models/ApplicationLog');
const User = require('../models/User');
const { sendNOCStatusEmail, notifyHeadApplicationForwarded, notifyOfficeNOCReady } = require('../utils/emailService');
const { enqueueEmail } = require('../utils/emailQueue');

const getOfficerApplications = async (req, res) => {
  try {
    if (req.user.role === 'TNPHead') {
      const applications = await Application.find({
        $or: [
          { status: 'UNDER_REVIEW_HEAD' },
          { approvedBy: req.user._id },
          { rejectedBy: req.user._id }
        ]
      })
        .populate('studentId', 'name email rollNumber')
        .populate('departmentId', 'name')
        .sort({ updatedAt: -1 });
      return res.json(applications);
    }

    // DeptOfficer: fetch only applications for their own department
    const applications = await Application.find({
      departmentId: req.user.departmentId,
      $or: [
        { status: { $in: ['SUBMITTED', 'UNDER_REVIEW_DEPT'] } },
        { recommendedBy: req.user._id },
        { rejectedBy: req.user._id }
      ]
    })
      .populate('studentId', 'name email rollNumber')
      .populate('departmentId', 'name')
      .sort({ updatedAt: -1 });
    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, remarks } = req.body;

    const application = await Application.findById(id)
      .populate('studentId', 'name email rollNumber')
      .populate('departmentId', 'name code');
    if (!application) return res.status(404).json({ message: 'Application not found' });

    const isHead = req.user.role === 'TNPHead';

    // Authorization: DeptOfficer can only act on their own department's applications
    if (!isHead && String(application.departmentId._id) !== String(req.user.departmentId)) {
      return res.status(403).json({ message: 'Not authorized to act on this application.' });
    }

    let newStatus = application.status;

    if (action === 'REJECT') {
      newStatus = isHead ? 'REJECTED_HEAD' : 'REJECTED_DEPT';
      application.rejectedAt = new Date();
      application.rejectedBy = req.user._id;
    } else if (action === 'APPROVE') {
      // Fix: set READY_FOR_COLLECTION directly — remove the dead APPROVED_FINAL intermediate
      newStatus = isHead ? 'READY_FOR_COLLECTION' : 'UNDER_REVIEW_HEAD';
      if (isHead) {
        application.currentStage = 'DONE';
        application.approvedAt = new Date();
        application.approvedBy = req.user._id;
      } else {
        application.recommendedAt = new Date();
        application.recommendedBy = req.user._id;
      }
    } else {
      return res.status(400).json({ message: `Invalid action: ${action}` });
    }

    application.status = newStatus;
    application.remarks = remarks || application.remarks;
    if (!application.rollNumber) application.rollNumber = 'N/A';

    await application.save();

    await ApplicationLog.create({
      applicationId: id,
      actionBy: req.user._id,
      role: req.user.role,
      action,
      remarks
    });

    // Notify student — fire-and-forget
    sendNOCStatusEmail({
      studentEmail: application.studentId.email,
      studentName: application.studentId.name,
      companyName: application.companyName,
      newStatus: application.status,
      remarks,
      actionByRole: isHead ? 'TNP Head' : 'Department Officer'
    }).catch(err => console.error('Failed to send status update email:', err.message));

    // Notify TNP Head when Department Officer forwards application
    if (!isHead && action === 'APPROVE' && newStatus === 'UNDER_REVIEW_HEAD') {
      const tnpHead = await User.findOne({ role: 'TNPHead' });
      if (tnpHead) {
        notifyHeadApplicationForwarded({
          headEmail: tnpHead.email,
          studentName: application.studentId.name,
          companyName: application.companyName,
          departmentName: application.departmentId?.name || 'Unknown Department',
          rollNumber: application.rollNumber || application.studentId.rollNumber || 'N/A'
        }).catch(err => console.error('Failed to send TNP Head notification:', err.message));
      }
    }

    // Notify TNP Office (NOT CDC Chairperson) when TNP Head approves and NOC is ready for collection
    if (isHead && action === 'APPROVE' && newStatus === 'READY_FOR_COLLECTION') {
      const tnpOfficeUsers = await User.find({ role: 'TNPOffice' }).select('email name');
      for (const tnpUser of tnpOfficeUsers) {
        notifyOfficeNOCReady({
          officeEmail: tnpUser.email,
          studentName: application.studentId.name,
          rollNumber: application.rollNumber || application.studentId.rollNumber || 'N/A',
          companyName: application.companyName
        }).catch(err => console.error('Failed to send TNP Office notification:', err.message));
      }
    }

    res.json(application);
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

module.exports = { getOfficerApplications, updateApplicationStatus };
