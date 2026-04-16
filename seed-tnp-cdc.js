/**
 * Safe seed script — creates TNP Head, TNP Office, and CDC Chairperson users.
 * Uses upsert logic: only creates a user if the email doesn't already exist.
 * NO existing data is deleted or modified.
 *
 * Usage: node seed-tnp-cdc.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/noc_portal');
    console.log('Connected to database.');

    const password = await bcrypt.hash('erp@noc', 10);

    const users = [
      { name: 'TNP Head',         email: 'tnphead@rgipt.ac.in',  role: 'TNPHead' },
      { name: 'TNP Office',       email: 'tnpoffice@rgipt.ac.in', role: 'TNPOffice' },
      { name: 'CDC Chairperson',  email: 'cdc@rgipt.ac.in',       role: 'CDCChairperson' },
    ];

    for (const u of users) {
      const existing = await User.findOne({ email: u.email });
      if (existing) {
        console.log(`⚠  Already exists — skipped: ${u.email} (${existing.role})`);
      } else {
        await User.create({ ...u, password });
        console.log(`✓  Created: ${u.email} | Role: ${u.role}`);
      }
    }

    console.log('');
    console.log('----------------------------------------------------');
    console.log('Seed complete. Credentials:');
    console.log('  TNP Head:        tnphead@rgipt.ac.in  | erp@noc');
    console.log('  TNP Office:      tnpoffice@rgipt.ac.in | erp@noc');
    console.log('  CDC Chairperson: cdc@rgipt.ac.in       | erp@noc');
    console.log('----------------------------------------------------');

    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
};

run();
