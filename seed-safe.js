const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const User = require('./models/User');
const Department = require('./models/Department');
const RoutingConfig = require('./models/RoutingConfig');

dotenv.config();

const seedDataSafe = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/noc_portal');

        console.log('Checking existing data...');

        // Define all RGIPT departments
        const departments = [
            { name: 'Chemical and Biochemical Engineering', code: 'CHE' },
            { name: 'Computer Science and Engineering', code: 'CSE' },
            { name: 'Electrical and Electronics Engineering', code: 'EEE' },
            { name: 'Management Studies', code: 'MS' },
            { name: 'Mathematical Sciences', code: 'MATHS' },
            { name: 'Mechanical Engineering', code: 'ME' },
            { name: 'Petroleum Engineering and Geoengineering', code: 'PEG' }
        ];

        // Create departments if they don't exist
        for (const deptData of departments) {
            const existing = await Department.findOne({ code: deptData.code });
            if (!existing) {
                await Department.create(deptData);
                console.log(`✓ Created department: ${deptData.name} (${deptData.code})`);
            } else {
                console.log(`✓ Department already exists: ${deptData.name} (${deptData.code})`);
            }
        }

        // Get CSE department for default assignments
        let dept = await Department.findOne({ code: 'CSE' });

        const password = await bcrypt.hash('erp@noc', 10);

        // Create users only if they don't exist
        const usersToCreate = [
            { name: 'Admin User', email: 'admin@rgipt.ac.in', password, role: 'Admin' },
            { name: 'TNP Head', email: 'tnphead@rgipt.ac.in', password, role: 'TNPHead' },
            { name: 'TNP Office', email: 'tnpoffice@rgipt.ac.in', password, role: 'TNPOffice' },
            { name: 'TNP Officer', email: 'officer@rgipt.ac.in', password, role: 'DeptOfficer', departmentId: dept._id },
            { name: 'Dummy Student', email: 'student@rgipt.ac.in', password, role: 'Student', departmentId: dept._id, rollNumber: '21CS101' },
            { name: 'CDC Chairperson', email: 'cdc@rgipt.ac.in', password, role: 'CDCChairperson' }
        ];

        for (const userData of usersToCreate) {
            const existing = await User.findOne({ email: userData.email });
            if (!existing) {
                await User.create(userData);
                console.log(`✓ Created user: ${userData.email}`);
            } else {
                console.log(`✓ User already exists: ${userData.email}`);
            }
        }

        // Check routing config
        const routingExists = await RoutingConfig.findOne({ departmentId: dept._id, roleType: 'tnp_coordinator' });
        if (!routingExists) {
            const officer = await User.findOne({ email: 'officer@rgipt.ac.in' });
            if (officer) {
                await RoutingConfig.create({ departmentId: dept._id, primaryApproverEmail: officer.email, roleType: 'tnp_coordinator' });
                console.log('✓ Created routing config');
            }
        } else {
            console.log('✓ Routing config already exists');
        }

        console.log('----------------------------------------------------');
        console.log('Safe seed completed successfully!');
        console.log('Password for ALL accounts: erp@noc');
        console.log('');
        console.log('Admin:           admin@rgipt.ac.in');
        console.log('TNP Head:        tnphead@rgipt.ac.in');
        console.log('TNP Office:      tnpoffice@rgipt.ac.in');
        console.log('TNP Officer:     officer@rgipt.ac.in');
        console.log('Student:         student@rgipt.ac.in');
        console.log('CDC Chairperson: cdc@rgipt.ac.in');
        console.log('----------------------------------------------------');

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

seedDataSafe();
