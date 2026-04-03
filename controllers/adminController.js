const Department = require('../models/Department');
const RoutingConfig = require('../models/RoutingConfig');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const { enqueueEmail } = require('../utils/emailQueue');

const getDepartments = async (req, res) => {
  try {
    const departments = await Department.find();
    res.json(departments);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const createDepartment = async (req, res) => {
  try {
    const { name, code } = req.body;
    const department = await Department.create({ name, code });
    res.status(201).json(department);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getRoutingConfigs = async (req, res) => {
  try {
    const configs = await RoutingConfig.find().populate('departmentId', 'name code');
    res.json(configs);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const createOrUpdateRoutingConfig = async (req, res) => {
  try {
    const { departmentId, primaryApproverEmail, roleType } = req.body;

    // Warn if no registered user with this email exists
    const assignedUser = await User.findOne({ email: primaryApproverEmail });
    const warning = !assignedUser
      ? `Warning: No registered user found with email ${primaryApproverEmail}. The routing rule will be saved but won't work until they register.`
      : null;

    let config = await RoutingConfig.findOne({ departmentId, roleType });
    if (config) {
      config.primaryApproverEmail = primaryApproverEmail;
      await config.save();
    } else {
      config = await RoutingConfig.create({ departmentId, primaryApproverEmail, roleType });
    }
    res.status(200).json({ ...config.toObject(), warning });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find().select('-password').populate('departmentId', 'name code').skip(skip).limit(limit),
      User.countDocuments()
    ]);
    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const assignRole = async (req, res) => {
  try {
    const { email, role, departmentId } = req.body;
    let user = await User.findOne({ email });

    // Generate a 6-digit temporary password
    const tempPassword = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedTemp = await bcrypt.hash(tempPassword, 12);

    if (!user) {
      user = await User.create({
        email,
        name: 'Pending User',
        password: hashedTemp,
        role,
        departmentId: departmentId || undefined,
        isPending: true
      });
    } else {
      // Use $set to force-write isPending even on old docs that predate the schema field
      user = await User.findOneAndUpdate(
        { email },
        { $set: { role, password: hashedTemp, isPending: true, ...(departmentId ? { departmentId } : {}) } },
        { new: true }
      );
    }

    enqueueEmail({
      to: email,
      subject: 'NOC Portal — Your Role & Temporary Password',
      text: `Hello,\n\nYou have been assigned the role of ${role} on the NOC Portal.\n\nYour temporary login password is:\n\n  ${tempPassword}\n\nPlease log in at ${process.env.CLIENT_URL || 'https://noc.rgiptresume.in'} using this email and temporary password. You should change it after your first login.\n\nThank you!`,
    });

    res.status(200).json({ message: `Role assigned and credentials emailed to ${email}!`, user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const resendInvite = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user || user.name !== 'Pending User') {
      return res.status(404).json({ message: 'No pending user found with this email.' });
    }

    // Generate a fresh 6-digit temporary password
    const tempPassword = Math.floor(100000 + Math.random() * 900000).toString();
    user.password = await bcrypt.hash(tempPassword, 12);
    await user.save();

    enqueueEmail({
      to: email,
      subject: 'NOC Portal — Your New Temporary Password',
      text: `Hello,\n\nYour registration invitation has been resent.\n\nYou have been assigned the role of ${user.role} on the NOC Portal.\n\nYour new temporary login password is:\n\n  ${tempPassword}\n\nPlease log in at ${process.env.CLIENT_URL || 'https://noc.rgiptresume.in'} using this email and temporary password.\n\nThank you!`,
    });

    res.status(200).json({ message: `Fresh credentials emailed to ${email}` });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.status(200).json({ message: `User ${user.email} deleted successfully.` });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getDepartments,
  createDepartment,
  getRoutingConfigs,
  createOrUpdateRoutingConfig,
  getUsers,
  assignRole,
  resendInvite,
  deleteUser
};
