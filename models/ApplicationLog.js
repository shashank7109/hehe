const mongoose = require('mongoose');

const applicationLogSchema = new mongoose.Schema({
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
  actionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, required: true },
  action: { type: String, required: true },
  remarks: { type: String, default: '' }
}, { timestamps: true });

applicationLogSchema.index({ applicationId: 1 });

module.exports = mongoose.model('ApplicationLog', applicationLogSchema);
