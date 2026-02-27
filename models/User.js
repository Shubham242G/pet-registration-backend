const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String },
  mobile: { type: String },
  role: { type: String, enum: ['user', 'salesman', 'admin'], default: 'user' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date }
}, { timestamps: true });

// ✅ FIX 1: Auto-hash passwords (CRITICAL)
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ✅ FIX 2: Soft delete queries
userSchema.pre(/^find/, function() {
  this.where({ isDeleted: false });
});

// ✅ FIX 3: Async compare (CRITICAL)
userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
