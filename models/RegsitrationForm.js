const mongoose = require('mongoose');

const registrationFormSchema = new mongoose.Schema({
  pet: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', required: true },
  name: { type: String, required: true },
  city: { type: String, required: true },
  animal: { type: String, required: true },
  breed: { type: String },
  documents: [{
    name: String,
    data: String,  // base64 ✅
    contentType: String
  }],
  isFilled: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('RegistrationForm', registrationFormSchema);
