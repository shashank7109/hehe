const mongoose = require('mongoose');

const routingConfigSchema = new mongoose.Schema({
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true, unique: true },
  primaryApproverEmail: { type: String, required: true },
  roleType: { type: String, enum: ['tnp_coordinator', 'hod'], required: true }
}, { timestamps: true });

module.exports = mongoose.model('RoutingConfig', routingConfigSchema);
