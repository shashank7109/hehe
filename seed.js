const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./models/User');
const Department = require('./models/Department');
const RoutingConfig = require('./models/RoutingConfig');

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/noc_portal');
    
    // Clear existing data to avoid duplicates
    await User.deleteMany();
    await Department.deleteMany();
    await RoutingConfig.deleteMany();

    // Create a dummy department
    const dept = await Department.create({ name: 'Computer Science and Engineering', code: 'CSE' });

    const password = await bcrypt.hash('password123', 10);

    // Create dummy users
    const admin = await User.create({ name: 'Admin User', email: 'admin@rgipt.ac.in', password, role: 'Admin' });
    const tnpHead = await User.create({ name: 'TNP Head', email: 'tnphead@rgipt.ac.in', password, role: 'TNPHead' });
    const officer = await User.create({ name: 'TNP Officer', email: 'officer@rgipt.ac.in', password, role: 'DeptOfficer', departmentId: dept._id });
    const student = await User.create({ name: 'Dummy Student', email: 'student@rgipt.ac.in', password, role: 'Student', departmentId: dept._id, rollNumber: '21CS101' });

    // Link officer to department routing
    await RoutingConfig.create({ departmentId: dept._id, primaryApproverEmail: officer.email, roleType: 'tnp_coordinator' });

    console.log('----------------------------------------------------');
    console.log('Dummy Users provisioned successfully! Password for all is: password123');
    console.log('Admin:       admin@rgipt.ac.in');
    console.log('TNP Head:    tnphead@rgipt.ac.in');
    console.log('TNP Officer: officer@rgipt.ac.in');
    console.log('Student:     student@rgipt.ac.in');
    console.log('----------------------------------------------------');
    
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedData();
