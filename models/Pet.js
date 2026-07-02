const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
  // Basic Information
  name: { type: String, required: true, maxlength: 50 },
  species: { type: String, required: true, default: 'dog' },

  // Age
  ageYears: { type: Number, required: true },
  ageMonths: { type: Number, required: true },

  // Photograph
  profilePicture: { type: String },

  // Gender
  gender: { type: String, enum: ['male', 'female', 'unknown'], default: 'unknown' },

  // City where pet is being registered
  city: { 
    type: String, 
    enum: ['ghaziabad', 'delhi', 'noida', 'gurgaon', 'faridabad', 'other'],
    default: 'other'
  },

  // ✅ Document fields
  antiRabiesCertificate: {
    fileData: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  },
  idProof: {
    fileData: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  },
  residenceProof: {
    fileData: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  },
  ownerWithPetPhoto: {
    fileData: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  },

  // ✅ NEW: Pet photo alone (without owner)
  petPhoto: {
    fileData: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  },

  // ✅ NEW: Vaccination Card
  vaccinationCard: {
    fileData: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  },

  // ✅ NEW: Vaccination Certificate
  vaccinationCertificate: {
    fileData: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  },

  // Sterilization Certificate
  sterilizationCertificate: {
    fileData: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  },

  // Tag Delivery
  tagDelivery: {
    option: { 
      type: String, 
      enum: ['collect_from_municipal', 'deliver_to_home', 'not_applicable'],
      default: 'collect_from_municipal'
    },
    cost: { type: Number, default: 0 },
  },

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

  // Registration Progress
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

  registrationTriggered: { type: Boolean, default: false },
  registrationTriggeredAt: { type: Date },

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

}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ✅ Virtuals - auto-calculated fields
petSchema.virtual('ageInYears').get(function () {
  return (this.ageYears || 0) + (this.ageMonths || 0) / 12;
});

petSchema.virtual('fullAge').get(function () {
  if (this.ageYears && this.ageMonths) return `${this.ageYears} years ${this.ageMonths} months`;
  if (this.ageYears) return `${this.ageYears} years`;
  if (this.ageMonths) return `${this.ageMonths} months`;
  return 'Unknown';
});

petSchema.virtual('registrationProgress').get(function () {
  return (this.registrationStage / 4) * 100;
});

// ✅ Check if sterilization is required
petSchema.virtual('isSterilizationRequired').get(function () {
  if (this.city !== 'gurgaon') return false;
  return this.ageInYears >= 4;
});

// ✅ Check if tag delivery is available
petSchema.virtual('isTagDeliveryAvailable').get(function () {
  return ['gurgaon', 'ghaziabad', 'delhi', 'noida'].includes(this.city);
});

// ✅ Calculate uploaded documents count - UPDATED with new docs
petSchema.virtual('uploadedDocumentsCount').get(function () {
  const docFields = [
    'antiRabiesCertificate', 
    'idProof', 
    'residenceProof', 
    'ownerWithPetPhoto',
    'petPhoto',
    'vaccinationCard',
    'vaccinationCertificate',
    'sterilizationCertificate'
  ];
  return docFields.filter(field => this[field]?.fileData).length;
});

// ✅ Get required documents count - UPDATED for Gurgaon
petSchema.virtual('requiredDocumentsCount').get(function () {
  const isGurgaon = this.city === 'gurgaon';
  let count = 4; // antiRabies, idProof, residenceProof, ownerWithPetPhoto
  
  if (isGurgaon) {
    count += 3; // petPhoto, vaccinationCard, vaccinationCertificate
    if (this.isSterilizationRequired) {
      count += 1; // sterilizationCertificate
    }
  }
  
  return count;
});

// ✅ Check if all documents are uploaded - UPDATED with new docs
petSchema.virtual('hasAllDocuments').get(function () {
  const isGurgaon = this.city === 'gurgaon';
  const docFields = ['antiRabiesCertificate', 'idProof', 'residenceProof', 'ownerWithPetPhoto'];
  
  if (isGurgaon) {
    docFields.push('petPhoto', 'vaccinationCard', 'vaccinationCertificate');
    if (this.isSterilizationRequired) {
      docFields.push('sterilizationCertificate');
    }
  }
  
  return docFields.every(field => this[field]?.fileData);
});

// ✅ Get all documents as an array - UPDATED with new docs
petSchema.virtual('documents').get(function () {
  const docs = [];
  const docFields = [
    'antiRabiesCertificate', 
    'idProof', 
    'residenceProof', 
    'ownerWithPetPhoto',
    'petPhoto',
    'vaccinationCard',
    'vaccinationCertificate',
    'sterilizationCertificate'
  ];
  
  for (const field of docFields) {
    if (this[field]?.fileData) {
      docs.push({
        documentName: field,
        fileName: this[field].fileName,
        fileSize: this[field].fileSize,
        fileData: this[field].fileData,
        mimeType: this[field].mimeType,
        uploadedAt: this[field].uploadedAt || new Date()
      });
    }
  }
  return docs;
});

module.exports = mongoose.model('Pet', petSchema);