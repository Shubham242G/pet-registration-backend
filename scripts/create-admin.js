// scripts/resetAdminPassword.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const NEW_PASSWORD = 'YourNewAdminPassword123'; // ← change this

async function resetAdminPassword() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const User = require('../models/User');

  // Bypass the pre('save') hook by using updateOne with a pre-hashed password
  // (The hook would double-hash if we used .save() — this is the safe way)
  const hashed = await bcrypt.hash(NEW_PASSWORD, 12);

  const result = await User.updateOne(
    { email: 'admin@tailio.in' },
    { $set: { password: hashed } }
  );

  if (result.matchedCount === 0) {
    console.log('❌ Admin user not found. Creating one...');
    const admin = new User({
      email: 'admin@tailio.in',
      name: 'Admin',
      role: 'admin',
      isVerified: true,
    });
    // Set password directly so hook hashes it once
    admin.password = NEW_PASSWORD;
    await admin.save();
    console.log('✅ Admin user created');
  } else {
    console.log('✅ Admin password reset successfully');
  }

  await mongoose.disconnect();
}

resetAdminPassword().catch(console.error);