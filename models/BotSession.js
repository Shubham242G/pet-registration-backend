// models/BotSession.js
const mongoose = require('mongoose');

const botSessionSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true, unique: true, index: true },
  
  // Current conversation state
  currentStep: {
    type: String,
    enum: [
      'welcome',
      'ask_name',
      'ask_pet_name',
      'ask_pet_age',
      'ask_pet_breed',
      'ask_gender',
      'ask_city',
      'ask_document_anti_rabies',
      'ask_document_id_proof',
      'ask_document_residence_proof',
      'ask_document_owner_photo',
      'ask_document_pet_photo',
      'ask_document_vaccination_card',
      'ask_payment',
      'complete',
      'abandoned'
    ],
    default: 'welcome'
  },
  
  // User collected data
  userData: {
    name: { type: String },
    city: { type: String },
    email: { type: String }
  },
  
  // Pet collected data
  petData: {
    name: { type: String },
    ageYears: { type: Number, default: 0 },
    ageMonths: { type: Number, default: 0 },
    breed: { type: String },
    gender: { type: String, enum: ['male', 'female', 'unknown'], default: 'unknown' }
  },
  
  // Document storage
  documents: {
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
    }
  },
  
  // Payment
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'completed', 'failed', 'not_started'], 
    default: 'not_started' 
  },
  paymentAmount: { type: Number },
  paymentId: { type: String },
  paymentOrderId: { type: String },
  
  // Status flags
  isComplete: { type: Boolean, default: false },
  isConverted: { type: Boolean, default: false },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  petId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet' },
  
  // Timestamps
  lastMessageAt: { type: Date, default: Date.now },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  
  // Conversation log (for debugging)
  conversationLog: [{
    direction: { type: String, enum: ['incoming', 'outgoing'] },
    message: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Source tracking
  source: { 
    type: String, 
    enum: ['bot', 'website', 'admin', 'whatsapp'],
    default: 'bot'
  }
}, { timestamps: true });

// Indexes for faster queries
botSessionSchema.index({ phoneNumber: 1, isComplete: 1 });
botSessionSchema.index({ isConverted: 1, createdAt: -1 });

// Virtual for document count
botSessionSchema.virtual('documentCount').get(function() {
  const docFields = ['antiRabiesCertificate', 'idProof', 'residenceProof', 'ownerWithPetPhoto', 'petPhoto', 'vaccinationCard'];
  return docFields.filter(field => this.documents[field]?.fileData).length;
});

// Virtual for required documents count
botSessionSchema.virtual('requiredDocumentCount').get(function() {
  const isGhaziabadNoida = ['Ghaziabad', 'Noida'].includes(this.userData?.city);
  const isGurgaon = this.userData?.city === 'Gurgaon';
  const isFaridabad = this.userData?.city === 'Faridabad';
  
  if (isFaridabad) return 6;
  if (isGurgaon) return 7;
  if (isGhaziabadNoida) return 7;
  return 4;
});

module.exports = mongoose.model('BotSession', botSessionSchema);