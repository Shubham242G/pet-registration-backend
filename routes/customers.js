const express = require('express');
const { auth, requireRole, requirePermission } = require('../middleware/auth');
const User = require('../models/User');
const Permission = require('../models/Permission');
const router = express.Router();

// GET /api/customers - Get customers (admin sees all, salesman sees assigned)
router.get('/', auth, async (req, res) => {
  try {
    let customers;
    
    if (req.user.role === 'admin') {
      customers = await User.find({ role: 'user', isDeleted: false }).select('-password');
    } else if (req.user.role === 'salesman') {
      // Salesman's own customers + permitted customers
      customers = await User.find({
        role: 'user',
        isDeleted: false,
        $or: [
          { createdBy: req.user._id }, // Customers they created
          // Add permission-based query later
        ]
      }).select('-password');
    }
    
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/customers - Create customer (salesman/admin only)
router.post('/', auth, requireRole('salesman', 'admin'), async (req, res) => {
  try {
    const { email, name, mobile, password, pets } = req.body;
    
    const user = new User({
      email,
      name,
      mobile,
      password, // Will be hashed by pre-save hook
      role: 'user',
      createdBy: req.user._id
    });
    
    await user.save();
    
    // If salesman created, auto-give edit permission
    if (req.user.role === 'salesman') {
      await Permission.create({
        salesman: req.user._id,
        customer: user._id,
        permission: 'edit'
      });
    }
    
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/customers/:id - Edit customer
router.put('/:id', auth, requirePermission, async (req, res) => {
  try {
    // Only allow edit if admin or has edit permission
    if (req.user.role !== 'admin' && req.permission !== 'edit') {
      return res.status(403).json({ message: 'Edit permission required' });
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-password');
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/customers/:id - Soft delete
router.delete('/:id', auth, requirePermission, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.permission !== 'edit') {
      return res.status(403).json({ message: 'Delete permission required' });
    }
    
    await User.findByIdAndUpdate(req.params.id, {
      isDeleted: true,
      deletedAt: new Date()
    });
    
    res.json({ message: 'Customer deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
