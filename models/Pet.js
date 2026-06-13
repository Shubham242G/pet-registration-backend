const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
  // Basic Information
  name: { type: String, required: true, maxlength: 50 },
  species: { type: String, required: true, default: 'dog' },

  // Age
  ageYears: { type: Number, required: true },
  ageMonths: { type: Number, required: true },

  // Photograph (owner with pet — collected in AddPetModal)
  profilePicture: { type: String },

  // Gender
  gender: { type: String, enum: ['male', 'female', 'unknown'], default: 'unknown' },

  // License Information
  license: {
    number: { type: String },
    issuedAt: { type: Date },
    expiresAt: { type: Date },
    fileData: { type: String },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    issuedOn: { type: Date, default: Date.now },
  },

  // Owner reference
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Registration Progress — 3 visible stages:
  // Stage 0 → not started (filling form / uploading docs)
  // Stage 1 → docs uploaded, awaiting payment
  // Stage 2 → paid + submitted (Registration Requested)
  // Stage 3 → awaiting license
  // Stage 4 → License Received
  registrationStage: {
    type: Number,
    enum: [0, 1, 2, 3, 4],
    default: 0,
  },

  registrationStatus: {
    type: String,
    enum: [
      'not_started',
      'documents_uploaded',
      'payment_completed',
      'form_submitted',
      'awaiting_license',
      'license_delivered',
    ],
    default: 'not_started',
  },

  // Cached fields from RegistrationForm (written by registration.js on every doc upload)
  uploadedDocumentsCount: { type: Number, default: 0 },
  hasAllDocuments: { type: Boolean, default: false },
  registrationTriggered: { type: Boolean, default: false },

  // Payment Fields
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  paymentId: { type: String },
  paymentOrderId: { type: String },
  paymentAmount: { type: Number },
  paymentDate: { type: Date },

}, { timestamps: true });

petSchema.virtual('fullAge').get(function () {
  if (this.ageYears && this.ageMonths) return `${this.ageYears} years ${this.ageMonths} months`;
  if (this.ageYears) return `${this.ageYears} years`;
  if (this.ageMonths) return `${this.ageMonths} months`;
  return 'Unknown';
});

petSchema.virtual('registrationProgress').get(function () {
  return (this.registrationStage / 4) * 100;
});

module.exports = mongoose.model('Pet', petSchema);