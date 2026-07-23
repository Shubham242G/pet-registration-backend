// models/Pet.js
const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
  // Basic Information
  name: { type: String, required: true, maxlength: 50 },
  species: { type: String, required: true, default: 'dog' },

  // Age
  ageYears: { type: Number, required: true },
  ageMonths: { type: Number, required: true },

  // Photograph
  profilePicture: { type: String, required: true },

  // Gender
  gender: { type: String, enum: ['male', 'female', 'unknown'], default: 'unknown' },

  // City where pet is being registered
  city: { 
    type: String, 
    enum: ['ghaziabad', 'delhi', 'noida', 'gurgaon', 'faridabad'],
    required: true,
    default: 'gurgaon'
  },

  // ✅ Common Document fields
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
  petPhoto: {
    fileData: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  },
  vaccinationCard: {
    fileData: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  },
  vaccinationCertificate: {
    fileData: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  },
  sterilizationCertificate: {
    fileData: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  },

  // ✅ Ghaziabad & Noida specific documents
  ownerPhoto: {
    fileData: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  },
  ownerSignature: {
    fileData: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  },

  // ✅ Faridabad specific documents
  proofOfIdentity: {
    fileData: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  },
  proofOfAddress: {
    fileData: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  },
  vaccinationRecord: {
    fileData: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  },
  petPhotographs: {
    fileData: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  },
  microchipDetails: {
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

// ✅ Calculate uploaded documents count
petSchema.virtual('uploadedDocumentsCount').get(function () {
  const isGurgaon = this.city === 'gurgaon';
  const isFaridabad = this.city === 'faridabad';
  const isGhaziabadNoida = ['ghaziabad', 'noida'].includes(this.city);
  
  let docFields = [
    'antiRabiesCertificate', 
    'idProof', 
    'residenceProof', 
    'ownerWithPetPhoto',
    'petPhoto',
    'vaccinationCard',
    'vaccinationCertificate',
    'sterilizationCertificate'
  ];
  
  if (isFaridabad) {
    docFields = [
      'proofOfIdentity',
      'proofOfAddress',
      'vaccinationRecord',
      'petPhotographs',
      'sterilizationCertificate',
      'microchipDetails'
    ];
  }
  
  if (isGhaziabadNoida) {
    docFields.push('ownerPhoto', 'ownerSignature');
  }
  
  return docFields.filter(field => this[field]?.fileData).length;
});

// ✅ Get required documents count
petSchema.virtual('requiredDocumentsCount').get(function () {
  const isGurgaon = this.city === 'gurgaon';
  const isFaridabad = this.city === 'faridabad';
  const isGhaziabadNoida = ['ghaziabad', 'noida'].includes(this.city);
  
  if (isFaridabad) {
    return 6;
  }
  
  let count = 4;
  
  if (isGurgaon) {
    count += 3;
    if (this.isSterilizationRequired) {
      count += 1;
    }
  }
  
  if (isGhaziabadNoida) {
    count += 4; // ownerPhoto, petPhoto, ownerSignature, antiRabiesCertificate (already have 4 base)
  }
  
  return count;
});

// ✅ Check if all documents are uploaded
petSchema.virtual('hasAllDocuments').get(function () {
  const isGurgaon = this.city === 'gurgaon';
  const isFaridabad = this.city === 'faridabad';
  const isGhaziabadNoida = ['ghaziabad', 'noida'].includes(this.city);
  
  if (isFaridabad) {
    const faridabadDocs = [
      'proofOfIdentity',
      'proofOfAddress',
      'vaccinationRecord',
      'petPhotographs',
      'sterilizationCertificate',
      'microchipDetails'
    ];
    return faridabadDocs.every(field => this[field]?.fileData);
  }
  
  const docFields = ['antiRabiesCertificate', 'idProof', 'residenceProof', 'ownerWithPetPhoto'];
  
  if (isGurgaon) {
    docFields.push('petPhoto', 'vaccinationCard', 'vaccinationCertificate');
    if (this.isSterilizationRequired) {
      docFields.push('sterilizationCertificate');
    }
  }
  
  if (isGhaziabadNoida) {
    docFields.push('ownerPhoto', 'petPhoto', 'ownerSignature');
  }
  
  return docFields.every(field => this[field]?.fileData);
});

// ✅ Get all documents as an array
petSchema.virtual('documents').get(function () {
  const docs = [];
  const isGurgaon = this.city === 'gurgaon';
  const isFaridabad = this.city === 'faridabad';
  const isGhaziabadNoida = ['ghaziabad', 'noida'].includes(this.city);
  
  let docFields = [
    'antiRabiesCertificate', 
    'idProof', 
    'residenceProof', 
    'ownerWithPetPhoto',
    'petPhoto',
    'vaccinationCard',
    'vaccinationCertificate',
    'sterilizationCertificate'
  ];
  
  if (isFaridabad) {
    docFields = [
      'proofOfIdentity',
      'proofOfAddress',
      'vaccinationRecord',
      'petPhotographs',
      'sterilizationCertificate',
      'microchipDetails'
    ];
  }
  
  if (isGhaziabadNoida) {
    docFields.push('ownerPhoto', 'ownerSignature');
  }
  
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