const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
  question: {
    type: String,
    required: [true, 'Question is required'],
    trim: true,
    index: true
  },
  answer: {
    type: String,
    required: [true, 'Answer is required']
  },
  pageId: {
    type: String,
    required: [true, 'Page ID is required'],
    enum: [
      'home', 
      'about', 
      'services', 
      'products', 
      'contact', 
      'support', 
      'pricing', 
      'blog', 
      'careers',
      'how-it-works',
      'why-tailio',
      'delhi',
      'noida',
      'faridabad',
      'gurugram',
      'ghaziabad'
    ],
    default: 'home',
    index: true
  },
  category: {
    type: String,
    trim: true,
    default: 'General',
    index: true
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  views: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Compound indexes for better performance
faqSchema.index({ pageId: 1, order: 1, isActive: 1 });
faqSchema.index({ pageId: 1, category: 1 });

// Text index for search
faqSchema.index({ question: 'text', answer: 'text' });

module.exports = mongoose.model('Faq', faqSchema);