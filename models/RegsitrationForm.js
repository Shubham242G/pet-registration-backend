// models/RegistrationForm.js
const mongoose = require('mongoose');

// Document sub-schema with Base64 storage
const documentStatusSchema = new mongoose.Schema({
  documentName: {
    type: String,
    enum: [
      'antiRabiesCertificate', 
      'idProof', 
      'residenceProof', 
      'ownerWithPetPhoto',
      'petPhoto',              // Gurgaon
      'vaccinationCard',       // Gurgaon
      'vaccinationCertificate', // Gurgaon
      'sterilizationCertificate', // Gurgaon (4+ years) & Faridabad
      // Faridabad docs
      'proofOfIdentity',
      'proofOfAddress',
      'vaccinationRecord',
      'petPhotographs',
      'microchipDetails',
    ],
    required: true,
  },
  fileData: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  mimeType: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

// Main Registration Form Schema
const registrationFormSchema = new mongoose.Schema({
  pet: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', required: true, unique: true },
  documents: [documentStatusSchema],
  registrationTriggered: { type: Boolean, default: false },
  registrationTriggeredAt: { type: Date },
  isComplete: { type: Boolean, default: false },
  paymentStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  paymentId: { type: String },
  paymentOrderId: { type: String },
  paymentAmount: { type: Number },
}, { timestamps: true });

// Virtuals
registrationFormSchema.virtual('uploadedDocumentsCount').get(function () {
  return this.documents.length;
});

registrationFormSchema.virtual('hasAllDocuments').get(function () {
  return this.documents.length >= 4;
});

registrationFormSchema.virtual('missingDocuments').get(function () {
  const requiredDocs = [
    'antiRabiesCertificate', 
    'idProof', 
    'residenceProof', 
    'ownerWithPetPhoto',
    'petPhoto',
    'vaccinationCard',
    'vaccinationCertificate',
    'sterilizationCertificate'
  ];
  const uploadedDocNames = this.documents.map(doc => doc.documentName);
  return requiredDocs.filter(doc => !uploadedDocNames.includes(doc));
});

registrationFormSchema.methods.triggerRegistration = async function (paymentVerified = false) {
  if (this.documents.length >= 4 && !this.registrationTriggered && paymentVerified) {
    this.registrationTriggered = true;
    this.registrationTriggeredAt = new Date();
    this.isComplete = true;
    await this.save();
    return true;
  }
  return false;
};

registrationFormSchema.set('toJSON', { virtuals: true });
registrationFormSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('RegistrationForm', registrationFormSchema);