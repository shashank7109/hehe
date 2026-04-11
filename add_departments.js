const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Department = require('./models/Department');

dotenv.config();

const departments = [
  { name: 'Chemical and Biochemical Engineering', code: 'CHE' },
  { name: 'Computer Science and Engineering', code: 'CSE' },
  { name: 'Electrical and Electronics Engineering', code: 'EEE' },
  { name: 'Management Studies', code: 'MS' },
  { name: 'Mathematical Sciences', code: 'MNC' },
  { name: 'Mechanical Engineering', code: 'ME' },
  { name: 'Petroleum Engineering and Geoengineering', code: 'PEG' }
];

const addDepartments = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/noc_portal');

    console.log('Adding departments to database...\n');

    for (const dept of departments) {
      const existing = await Department.findOne({ code: dept.code });
      if (existing) {
        console.log(`✓ Department already exists: ${dept.name} (${dept.code})`);
      } else {
        await Department.create(dept);
        console.log(`✓ Created department: ${dept.name} (${dept.code})`);
      }
    }

    console.log('\n----------------------------------------------------');
    console.log('All departments added successfully!');
    console.log('----------------------------------------------------');
    console.log('\nDepartments in database:');
    const allDepts = await Department.find().sort({ name: 1 });
    allDepts.forEach(d => {
      console.log(`  - ${d.name} (${d.code})`);
    });
    console.log('----------------------------------------------------');

    process.exit(0);
  } catch (error) {
    console.error('Error adding departments:', error);
    process.exit(1);
  }
};

addDepartments();
