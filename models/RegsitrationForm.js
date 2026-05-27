const mongoose = require('mongoose');

// Document status schema with Base64
const documentStatusSchema = new mongoose.Schema({
  documentName: { 
    type: String, 
    enum: ['antiRabiesCertificate', 'idProof', 'residenceProof', 'ownerWithPetPhoto'],
    required: true 
  },
  fileData: { type: String, required: true }, // Base64 data
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  mimeType: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now }
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
  paymentOrderId: { type: String }
}, { timestamps: true });

// Virtuals
registrationFormSchema.virtual('uploadedDocumentsCount').get(function() {
  return this.documents.length;
});

registrationFormSchema.virtual('hasAllDocuments').get(function() {
  return this.documents.length === 4;
});

registrationFormSchema.virtual('missingDocuments').get(function() {
  const requiredDocs = ['antiRabiesCertificate', 'idProof', 'residenceProof', 'ownerWithPetPhoto'];
  const uploadedDocNames = this.documents.map(doc => doc.documentName);
  return requiredDocs.filter(doc => !uploadedDocNames.includes(doc));
});

// Method to trigger registration - NOW REQUIRES PAYMENT VERIFICATION
registrationFormSchema.methods.triggerRegistration = async function(verifyPayment = false) {
  // Only allow trigger if all documents are uploaded, NOT already triggered, AND payment is verified
  if (this.documents.length === 4 && !this.registrationTriggered && verifyPayment) {
    this.registrationTriggered = true;
    this.registrationTriggeredAt = new Date();
    this.isComplete = true;
    await this.save();
    
    // Update pet's registration stage
    const Pet = mongoose.model('Pet');
    await Pet.findByIdAndUpdate(this.pet, {
      registrationStage: 2,
      registrationStatus: 'form_submitted'
    });
    
    return true;
  }
  return false;
};

registrationFormSchema.set('toJSON', { virtuals: true });
registrationFormSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('RegistrationForm', registrationFormSchema);