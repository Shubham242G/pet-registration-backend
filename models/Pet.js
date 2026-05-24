const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
  // Basic Information
  name: { type: String, required: true, maxlength: 50 },
  species: { type: String, required: true, default: 'dog' },
  
  // Dog Details (from the form)
  breed: { type: String, required: true },
  ageYears: { type: Number, required: true },
  ageMonths: { type: Number, required: true },
  
  // Photograph
  profilePicture: { type: String }, // Base64 image - Dog photograph with owner
  photoWithOwner: { type: String }, // Additional field for owner with pet photo
  
  // Vaccination Details
  vaccinationCertificateNumber: { type: String, required: true, maxlength: 50 },
  vaccinationDate: { type: Date, required: true }, // DD/MM/YYYY
  vaccinationValidTill: { type: Date },
  
  // Veterinary Doctor Details
  vetName: { type: String, required: true, maxlength: 50 },
  vetMobile: { type: String, required: true, maxlength: 10 },
 
  
  // Additional Fields
  gender: { type: String, enum: ['male', 'female', 'unknown'], default: 'unknown' },
  color: String,
  
  // Owner reference
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Registration Progress Tracking
  registrationStage: {
    type: Number,
    enum: [0, 1, 2, 3, 4],
    default: 0
  },
  registrationStatus: {
    type: String,
    enum: ['not_started', 'documents_uploaded', 'form_submitted', 'awaiting_license', 'license_delivered'],
    default: 'not_started'
  }
}, { timestamps: true });

// Virtual for full age display
petSchema.virtual('fullAge').get(function() {
  if (this.ageYears && this.ageMonths) {
    return `${this.ageYears} years ${this.ageMonths} months`;
  } else if (this.ageYears) {
    return `${this.ageYears} years`;
  } else if (this.ageMonths) {
    return `${this.ageMonths} months`;
  }
  return 'Unknown';
});

// Virtual for registration progress percentage
petSchema.virtual('registrationProgress').get(function() {
  return (this.registrationStage / 4) * 100;
});

module.exports = mongoose.model('Pet', petSchema);