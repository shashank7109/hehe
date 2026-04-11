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

    // Global roles must never have a department
    const isGlobalRole = ['TNPHead', 'TNPOffice', 'CDCChairperson', 'Admin'].includes(role);
    const finalDepartmentId = isGlobalRole ? null : (departmentId || undefined);

    if (!user) {
      user = await User.create({
        email,
        name: 'Pending User',
        password: hashedTemp,
        role,
        departmentId: finalDepartmentId,
        isPending: true
      });
    } else {
      // Existing user: update role/dept and reset password, but do NOT set isPending
      // (they are already registered — setting isPending would allow re-registration to overwrite their account)
      user = await User.findOneAndUpdate(
        { email },
        { $set: { role, password: hashedTemp, departmentId: finalDepartmentId } },
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

/**
 * Get global role assignments (TNP Head, TNP Office, CDC Chairperson)
 */
const getGlobalRoles = async (req, res) => {
  try {
    const globalRoles = await User.find({
      role: { $in: ['TNPHead', 'TNPOffice', 'CDCChairperson'] }
    }).select('email role name isPending');

    res.json(globalRoles);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Update global role assignment (TNP Head, TNP Office, or CDC Chairperson)
 * Creates or updates the user with the specified role
 */
const updateGlobalRole = async (req, res) => {
  try {
    const { role, email } = req.body;

    // Validate role
    if (!['TNPHead', 'TNPOffice', 'CDCChairperson'].includes(role)) {
      return res.status(400).json({ message: 'Invalid global role. Must be TNPHead, TNPOffice, or CDCChairperson.' });
    }

    // Check if a user with this role already exists
    const existingRoleUser = await User.findOne({ role });

    // Check if the email is already in use by another user
    const existingEmailUser = await User.findOne({ email });

    // Generate a 6-digit temporary password
    const tempPassword = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedTemp = await bcrypt.hash(tempPassword, 12);

    let user;
    let isNewUser = false;

    // Global roles must never have a department
    const isGlobalRole = ['TNPHead', 'TNPOffice', 'CDCChairperson'].includes(role);

    if (existingRoleUser && existingRoleUser.email === email) {
      // Same user, just update password
      existingRoleUser.password = hashedTemp;
      existingRoleUser.isPending = true;
      if (isGlobalRole) existingRoleUser.departmentId = null;
      await existingRoleUser.save();
      user = existingRoleUser;
    } else if (existingRoleUser && existingEmailUser) {
      // Both role and email exist but are different users
      // Delete the old role user and update the email user to have this role
      await User.findByIdAndDelete(existingRoleUser._id);
      existingEmailUser.role = role;
      existingEmailUser.password = hashedTemp;
      existingEmailUser.isPending = true;
      existingEmailUser.departmentId = null; // Global roles don't have departments
      await existingEmailUser.save();
      user = existingEmailUser;
    } else if (existingRoleUser && !existingEmailUser) {
      // Role exists but email doesn't - update the role user's email
      existingRoleUser.email = email;
      existingRoleUser.password = hashedTemp;
      existingRoleUser.isPending = true;
      existingRoleUser.name = 'Pending User';
      if (isGlobalRole) existingRoleUser.departmentId = null;
      await existingRoleUser.save();
      user = existingRoleUser;
    } else if (existingEmailUser && !existingRoleUser) {
      // Email exists but role doesn't - update their role
      existingEmailUser.role = role;
      existingEmailUser.password = hashedTemp;
      existingEmailUser.isPending = true;
      existingEmailUser.departmentId = null; // Global roles don't have departments
      await existingEmailUser.save();
      user = existingEmailUser;
    } else {
      // Neither exists - create new user
      user = await User.create({
        email,
        name: 'Pending User',
        password: hashedTemp,
        role,
        isPending: true
      });
      isNewUser = true;
    }

    // Send email notification
    const roleNames = { TNPHead: 'TNP Head', TNPOffice: 'TNP Office', CDCChairperson: 'CDC Chairperson' };
    enqueueEmail({
      to: email,
      subject: `NOC Portal — ${roleNames[role]} Role Assignment`,
      text: `Hello,\n\nYou have been assigned the role of ${roleNames[role]} on the NOC Portal.\n\nYour temporary login password is:\n\n  ${tempPassword}\n\nPlease log in at ${process.env.CLIENT_URL || 'https://noc.rgiptresume.in'} using this email and temporary password.\n\nThank you!`,
    });

    res.status(200).json({
      message: `${roleNames[role]} role assigned to ${email}!`,
      user,
      isNewUser
    });
  } catch (error) {
    console.error('[updateGlobalRole] Error:', error);
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
  deleteUser,
  getGlobalRoles,
  updateGlobalRole
};
