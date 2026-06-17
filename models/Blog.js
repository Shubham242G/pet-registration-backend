const mongoose = require('mongoose');

const FaqSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true }
}, { _id: false });

const BlogSchema = new mongoose.Schema(
  {
    slug: { 
      type: String, 
      required: [true, 'Slug is required for URL'], 
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    date: { type: Date, required: true },
    title: { type: String, required: true },
    summary: { type: String, required: true },
    content: { type: String, default: '' },
    
    // NEW: Category field
    category: { 
      type: String, 
      enum: ['Pet Law', 'Health & Vax', 'How-to Guides', 'News', 'Pet Tips', 'Enforcement'],
      default: 'Pet Tips'
    },

    // NEW: Author field
    author: { type: String, default: 'Tailio Editorial' },
    
    // NEW: Read time in minutes
    readTime: { type: Number, default: 5 },

    // NEW: Tags array
    tags: { type: [String], default: [] },

    // NEW: Featured flag
    isFeatured: { type: Boolean, default: false },

    images: {
      thumbnail: { type: String, default: '' },
      cover: { type: String, default: '' },
      gallery: { type: [String], default: [] }
    },

    faqs: [FaqSchema],

    seoFocusKeyword: { type: String, default: '' },
    seoTitle: { type: String, default: '' },
    seoMetaDescription: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Blog', BlogSchema);