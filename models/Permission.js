const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  salesman: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  permission: { type: String, enum: ['view', 'edit'], required: true }
}, { timestamps: true });

module.exports = mongoose.model('Permission', permissionSchema);
