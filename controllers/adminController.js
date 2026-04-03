const Department = require('../models/Department');
const RoutingConfig = require('../models/RoutingConfig');
const User = require('../models/User');
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
    let config = await RoutingConfig.findOne({ departmentId, roleType });
    if (config) {
      config.primaryApproverEmail = primaryApproverEmail;
      await config.save();
    } else {
      config = await RoutingConfig.create({ departmentId, primaryApproverEmail, roleType });
    }
    res.status(200).json(config);
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
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await User.create({
        email,
        name: 'Pending User',
        password: 'PENDING_USER_NO_PASSWORD',
        role,
        departmentId: departmentId || undefined
      });
    } else {
      user.role = role;
      if (departmentId) user.departmentId = departmentId;
      await user.save();
    }

    enqueueEmail({
      to: email,
      subject: 'Welcome to NOC Portal - Role Assigned',
      text: `Hello,\n\nYou have been assigned the role of ${role} on the NOC Portal.\nPlease register or log in to access your dashboard.\n\nThank you!`,
    });

    if (isNewUser) {
      return res.status(200).json({ message: `Pre-assigned! When ${email} registers, they will automatically be a ${role}.`, user });
    }

    res.status(200).json({ message: 'Role assigned successfully to existing user!', user });
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
  assignRole
};
