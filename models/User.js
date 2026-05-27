const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // PRIMARY CREDENTIAL - WhatsApp number
  whatsappNumber: { type: String, required: true, unique: true, index: true },
  
  // Secondary credentials (optional)
  email: { type: String, unique: true, sparse: true },
  username: { type: String, unique: true, sparse: true },
  password: { type: String }, // Optional for WhatsApp-only users
  
  // User details
  name: { type: String },
  mobile: { type: String }, // Alternative number if different from WhatsApp
  
  // Role and permissions
  role: { type: String, enum: ['user', 'salesman', 'admin'], default: 'user' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Status flags
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  isVerified: { type: Boolean, default: false },
  lastLoginAt: { type: Date },
  
  // WhatsApp specific
  whatsappOptIn: { type: Boolean, default: true }
}, { timestamps: true });

// Auto-hash password if provided
userSchema.pre('save', async function () {
  if (this.password && this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

userSchema.pre(/^find/, function() {
  this.where({ isDeleted: false });
});

userSchema.methods.comparePassword = async function(password) {
  if (!this.password) return false;
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);