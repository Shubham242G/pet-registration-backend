const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // PRIMARY CREDENTIAL - WhatsApp number (required for website users, can be null for admin)
  whatsappNumber: { 
    type: String, 
    unique: true, 
    sparse: true, // Allows null/undefined for admin users
    index: true 
  },
  
  // Secondary credentials (for admin email login)
  email: { type: String, unique: true, sparse: true },
  username: { type: String, unique: true, sparse: true },
  password: { type: String }, // Required for admin, optional for WhatsApp users
  
  // User details
  name: { type: String },
  mobile: { type: String },
  
  // City for pricing
  city: { 
    type: String, 
    enum: ['ghaziabad', 'delhi', 'noida', 'gurgaon', 'faridabad', 'other'],
    default: 'other'
  },
  pricingTier: { 
    type: String, 
    enum: ['ghaziabad', 'standard'], 
    default: 'standard' 
  },
  
  // Store the actual registration fee
  registrationFee: { type: Number, default: 999 },
  
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

// Virtual for registration fee (fallback if not stored)
userSchema.virtual('calculatedRegistrationFee').get(function() {
  return this.city === 'ghaziabad' ? 1499 : 999;
});

// Auto-hash password if provided
userSchema.pre('save', async function() {
  if (this.password && this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

// Exclude deleted users from queries
userSchema.pre(/^find/, function() {
  this.where({ isDeleted: false });
});

// Compare password method
userSchema.methods.comparePassword = async function(password) {
  if (!this.password) return false;
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);