// backend/models/OTP.js
const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  whatsappNumber: { type: String, required: true, index: true },
  otpCode: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  isUsed: { type: Boolean, default: false },
  
  // Store temporary user data for registration
  tempUserData: {
    name: { type: String },
    email: { type: String },
    username: { type: String },
    password: { type: String }
  },
  
  createdAt: { type: Date, default: Date.now }
});

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OTP', otpSchema);