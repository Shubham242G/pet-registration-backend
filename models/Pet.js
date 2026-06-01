const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
  // Basic Information
  name: { type: String, required: true, maxlength: 50 },
  species: { type: String, required: true, default: 'dog' },

  // Dog Details
  breed: { type: String, required: true },
  ageYears: { type: Number, required: true },
  ageMonths: { type: Number, required: true },

  // Photograph
  profilePicture: { type: String },
  photoWithOwner: { type: String },

  // Vaccination Details
  vaccinationCertificateNumber: { type: String, required: true, maxlength: 50 },
  vaccinationDate: { type: Date, required: true },
  vaccinationValidTill: { type: Date },

  // Veterinary Doctor Details
  vetName: { type: String, required: true, maxlength: 50 },
  vetMobile: { type: String, required: true, maxlength: 10 },

  // Additional Fields
  gender: { type: String, enum: ['male', 'female', 'unknown'], default: 'unknown' },
  color: String,

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

  // Registration Progress Tracking
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

  // ─── CACHED FIELDS from RegistrationForm ────────────────────────────────────
  // These mirror values from the RegistrationForm collection so the dashboard
  // only needs GET /pets (1 call) instead of GET /pets + N status calls.
  // They are written by registration.js whenever documents are uploaded/deleted
  // or registration is triggered. Read by Dashboard.tsx directly from pet object.
  uploadedDocumentsCount: { type: Number, default: 0 },   // mirrors form.documents.length
  hasAllDocuments:        { type: Boolean, default: false }, // mirrors form.hasAllDocuments
  registrationTriggered:  { type: Boolean, default: false }, // mirrors form.registrationTriggered
  // ─────────────────────────────────────────────────────────────────────────────

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

// Virtual for full age display
petSchema.virtual('fullAge').get(function () {
  if (this.ageYears && this.ageMonths) {
    return `${this.ageYears} years ${this.ageMonths} months`;
  } else if (this.ageYears) {
    return `${this.ageYears} years`;
  } else if (this.ageMonths) {
    return `${this.ageMonths} months`;
  }
  return 'Unknown';
});

petSchema.virtual('registrationProgress').get(function () {
  return (this.registrationStage / 4) * 100;
});

module.exports = mongoose.model('Pet', petSchema);