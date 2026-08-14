// models/Cart.js
const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variant: mongoose.Schema.Types.ObjectId,
    quantity: { type: Number, required: true, min: 1, default: 1 }
  }],
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Methods
cartSchema.methods.addItem = function(productId, variantId = null, quantity = 1) {
  const existingItem = this.items.find(
    item => item.product.toString() === productId && 
           (item.variant?.toString() === variantId || (!item.variant && !variantId))
  );
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    this.items.push({ product: productId, variant: variantId, quantity });
  }
  
  this.updatedAt = new Date();
  return this.save();
};

cartSchema.methods.removeItem = function(productId, variantId = null) {
  this.items = this.items.filter(
    item => !(item.product.toString() === productId && 
              (item.variant?.toString() === variantId || (!item.variant && !variantId)))
  );
  this.updatedAt = new Date();
  return this.save();
};

cartSchema.methods.clearCart = function() {
  this.items = [];
  this.updatedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Cart', cartSchema);