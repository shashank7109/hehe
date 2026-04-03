/**
 * Dev utility — creates/updates a single user without touching existing data.
 * Usage: node createDevUser.js
 */
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const email = 'tnpoffice@rgipt.ac.in';
  const password = await bcrypt.hash('password123', 10);

  const user = await User.findOneAndUpdate(
    { email },
    { name: 'TNP Office', email, password, role: 'TNPOffice' },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log(`Done! User: ${user.email} | Role: ${user.role}`);
  process.exit(0);
};

run().catch(err => { console.error(err); process.exit(1); });
