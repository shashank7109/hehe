const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Department = require('./models/Department');
dotenv.config();

const departments = [
  { name: 'Chemical and Biochemical Engineering', code: 'CBE' },
  { name: 'Computer Science and Engineering', code: 'CSE' },
  { name: 'Electrical and Electronics Engineering', code: 'EEE' },
  { name: 'Mathematical Sciences', code: 'MS' },
  { name: 'Mechanical Engineering', code: 'ME' },
  { name: 'Petroleum Engineering and Geoengineering', code: 'PEG' }
];

const seedDepartments = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/noc_portal');
    
    for (const d of departments) {
      // Upsert to ensure we don't accidentally duplicate CSE if it already exists
      await Department.findOneAndUpdate(
        { name: d.name }, 
        { $set: d }, 
        { upsert: true, new: true }
      );
    }
    
    console.log('All missing departments populated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error populating departments:', error);
    process.exit(1);
  }
};

seedDepartments();
