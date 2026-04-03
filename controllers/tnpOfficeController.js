const Application = require('../models/Application');
const ApplicationLog = require('../models/ApplicationLog');
const { enqueueEmail } = require('../utils/emailQueue');

const getTNPOfficeApplications = async (req, res) => {
  try {
    const applications = await Application.find({
      status: { $in: ['UNDER_REVIEW_HEAD', 'READY_FOR_COLLECTION', 'COLLECTED', 'REJECTED_HEAD'] }
    })
      .populate('studentId', 'name email rollNumber')
      .populate('departmentId', 'name')
      .sort({ updatedAt: -1 });

    return res.status(200).json(applications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateTNPOfficeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    if (action !== 'COLLECTED') {
      return res.status(403).json({ message: 'TNPOffice can only perform COLLECTED action' });
    }

    const application = await Application.findById(id).populate('studentId', 'name email');
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.status !== 'READY_FOR_COLLECTION') {
      return res.status(400).json({ message: 'Application is not ready for collection' });
    }

    application.status = 'COLLECTED';
    await application.save();

    await ApplicationLog.create({
      applicationId: id,
      actionBy: req.user._id,
      role: 'TNPOffice',
      action: 'COLLECTED'
    });

    enqueueEmail({
      to: application.studentId.email,
      subject: `NOC Collected — ${application.companyName}`,
      text: `Dear ${application.studentId.name},\n\nYour NOC hardcopy for ${application.companyName} has been collected by the TNP Office.\n\nRegards,\nRGIPT TNP Cell`
    }).catch(err => console.error('Failed to enqueue COLLECTED email:', err.message));

    return res.status(200).json(application);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getTNPOfficeApplications, updateTNPOfficeStatus };
