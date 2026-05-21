const mongoose = require('mongoose');

// Applicant Details Schema
const applicantDetailsSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  middleName: { type: String },
  lastName: { type: String, required: true },
  dob: { type: String }
});

// Address Schema
const addressSchema = new mongoose.Schema({
  plot: { type: String, required: true },
  street: { type: String },
  pin: { type: String, required: true },
  colony: { type: String, required: true },
  ward: { type: String },
  zone: { type: String },
  mobile: { type: String, required: true },
  email: { type: String, required: true }
});

// Dog Details Schema
const dogDetailsSchema = new mongoose.Schema({
  gender: { type: String, required: true },
  photo: { type: String },
  breed: { type: String },
  ageYears: { type: String },
  ageMonths: { type: String },
  antiRabiesDate: { type: String },
  vaccinationValidTill: { type: String },
  certificateNumber: { type: String },
  certificateDate: { type: String },
  vetName: { type: String },
  councilName: { type: String },
  vetRegistrationNumber: { type: String },
  vetMobile: { type: String }
});

// Documents Schema
const documentsSchema = new mongoose.Schema({
  antiRabiesCertificate: { type: String },
  idProof: { type: String },
  residenceProof: { type: String },
  ownerWithPetPhoto: { type: String }
});

// Main Registration Form Schema
const registrationFormSchema = new mongoose.Schema({
  pet: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', required: true },
  applicantDetails: applicantDetailsSchema,
  address: addressSchema,
  dogDetails: dogDetailsSchema,
  documents: documentsSchema,
  isFilled: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('RegistrationForm', registrationFormSchema);