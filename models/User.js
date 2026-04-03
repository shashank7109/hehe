const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['Student', 'DeptOfficer', 'TNPHead', 'TNPOffice', 'Admin'],
    default: 'Student'
  },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: false },
  rollNumber: { type: String, required: false },
  isPending: { type: Boolean, default: false } // true = pre-assigned by Admin, hasn't logged in yet
}, { timestamps: true });

userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);
