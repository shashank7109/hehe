const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Department = require('./models/Department');

dotenv.config();

const updateMathDept = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/noc_portal');

        console.log('Updating Mathematical Sciences department code...\n');

        const result = await Department.findOneAndUpdate(
            { code: 'MATHS' },
            { code: 'MNC' },
            { new: true }
        );

        if (result) {
            console.log(`✓ Updated department code: ${result.name}`);
            console.log(`  Old code: MATHS`);
            console.log(`  New code: ${result.code}`);
        } else {
            console.log('✗ Department with code MATHS not found');
        }

        console.log('\n----------------------------------------------------');
        console.log('Update completed!');
        console.log('----------------------------------------------------');

        process.exit(0);
    } catch (error) {
        console.error('Error updating department:', error);
        process.exit(1);
    }
};

updateMathDept();
