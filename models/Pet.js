const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
  name: { type: String, required: true },
  species: { type: String, required: true },
  breed: String,
  age: Number,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  documents: [{
    name: String,
    data: String, // base64
    contentType: String
  }],
  registrationFormStatus: {
  hasForm: { type: Boolean, default: false },
  isFilled: { type: Boolean, default: false }
}
  
}, { timestamps: true });

module.exports = mongoose.model('Pet', petSchema);
