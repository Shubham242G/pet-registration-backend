// backend/routes/admin.js - ADD THIS NEW FILE
const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const RegistrationForm = require('../../models/RegsitrationForm');
const Pet = require('../../models/Pet');
const User = require('../../models/User');

// Get all registration forms (admin only)
router.get('/registrations', auth, requireRole('admin'), async (req, res) => {
  try {
    const registrations = await RegistrationForm.find()
      .populate('pet')
      .sort({ createdAt: -1 });
    res.json(registrations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all pets (admin only)
router.get('/pets', auth, requireRole('admin'), async (req, res) => {
  try {
    const pets = await Pet.find()
      .populate('owner', 'name email username mobile')
      .sort({ createdAt: -1 });
    res.json(pets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all users (admin only)
router.get('/users', auth, requireRole('admin'), async (req, res) => {
  try {
    const users = await User.find({ role: 'user' })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get statistics (admin only)
router.get('/stats', auth, requireRole('admin'), async (req, res) => {
  try {
    const totalRegistrations = await RegistrationForm.countDocuments();
    const totalPets = await Pet.countDocuments();
    const totalUsers = await User.countDocuments({ role: 'user' });
    const recentRegistrations = await RegistrationForm.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });
    
    res.json({ totalRegistrations, totalPets, totalUsers, recentRegistrations });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;