// routes/cart.js
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

// ─── GET CART ────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product', 'name price images slug inStock');
    
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }
    
    res.json({ success: true, cart });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── ADD TO CART ────────────────────────────────────────────────────────
router.post('/add', auth, async (req, res) => {
  try {
    const { productId, variantId, quantity = 1 } = req.body;
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    if (!product.inStock || product.quantity < quantity) {
      return res.status(400).json({ success: false, error: 'Product out of stock' });
    }
    
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }
    
    await cart.addItem(productId, variantId, quantity);
    await cart.populate('items.product', 'name price images slug inStock');
    
    res.json({ success: true, cart });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── UPDATE CART ITEM ──────────────────────────────────────────────────
router.put('/update', auth, async (req, res) => {
  try {
    const { productId, variantId, quantity } = req.body;
    
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ success: false, error: 'Cart not found' });
    }
    
    await cart.updateQuantity(productId, quantity, variantId);
    await cart.populate('items.product', 'name price images slug inStock');
    
    res.json({ success: true, cart });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── REMOVE FROM CART ──────────────────────────────────────────────────
router.delete('/remove', auth, async (req, res) => {
  try {
    const { productId, variantId } = req.body;
    
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ success: false, error: 'Cart not found' });
    }
    
    await cart.removeItem(productId, variantId);
    await cart.populate('items.product', 'name price images slug inStock');
    
    res.json({ success: true, cart });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── CLEAR CART ─────────────────────────────────────────────────────────
router.delete('/clear', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
      await cart.clearCart();
    }
    res.json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;