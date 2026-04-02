const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },

  // Digitized Offline Form Fields
  rollNumber: { type: String, required: true },
  degreeCourse: { type: String, required: true },
  branch: { type: String, required: true },
  currentYear: { type: String, enum: ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', 'Other'], required: true },
  yearSession: { type: String, required: true },
  latestCPI: { type: Number, required: true },
  contactNo: { type: String, required: true },
  internshipType: { type: String, required: true },
  durationFrom: { type: String, required: true },
  durationTo: { type: String, required: true },
  companyName: { type: String, required: true },
  organizationAddress: { type: String, required: true },
  mentorName: { type: String, required: true },
  mentorDesignation: { type: String, required: true },
  mentorContact: { type: String, required: true },
  mentorEmail: { type: String, required: true },
  addresseeName: { type: String, required: false },
  addresseeDesignation: { type: String, required: false },
  addresseeContact: { type: String, required: false },
  addresseeEmail: { type: String, required: false },

  // Workflow tracking
  status: {
    type: String,
    enum: [
      'SUBMITTED', 'UNDER_REVIEW_DEPT', 'REJECTED_DEPT', 'APPROVED_DEPT',
      'UNDER_REVIEW_HEAD', 'REJECTED_HEAD',
      'READY_FOR_COLLECTION', 'COLLECTED'
    ],
    default: 'SUBMITTED'
  },
  currentStage: { type: String, enum: ['DEPT', 'HEAD', 'DONE'], default: 'DEPT' },

  // Documents
  offerLetter: { type: String, required: false },
  statementOfObjective: { type: String, required: false },
  mandatoryDocument: { type: String, required: true },
  nocFormat: { type: String, required: false },
  studentMessage: { type: String, default: '' },
  remarks: { type: String, default: '' },

  // Audit Trail
  appliedAt: { type: Date, default: Date.now },
  recommendedAt: { type: Date },
  recommendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedAt: { type: Date },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Indexes for common query patterns
applicationSchema.index({ studentId: 1, status: 1 });
applicationSchema.index({ departmentId: 1, status: 1 });
applicationSchema.index({ status: 1 });

module.exports = mongoose.model('Application', applicationSchema);
