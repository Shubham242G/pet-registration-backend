const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const RegistrationForm = require('../../models/RegsitrationForm'); // Your actual filename
const Pet = require('../../models/Pet');
const User = require('../../models/User');

router.use(auth);
router.use(requireRole('admin'));

// ===== TEST ENDPOINT =====
router.get('/test', (req, res) => {
  res.json({ 
    message: '✅ Admin routes working!',
    user: { id: req.user._id, role: req.user.role }
  });
});

// ===== DASHBOARD STATS =====
router.get('/dashboard/stats', async (req, res) => {
  console.log('📊 Dashboard stats requested');
  try {
    const [totalCustomers, totalPets, totalRegistrations] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Pet.countDocuments(),
      RegistrationForm.countDocuments()
    ]);
    
    res.json({
      totalCustomers,
      totalPets,
      totalRegistrations,
      completedRegistrations: 0,
      pendingRegistrations: totalRegistrations,
      recentRegistrations: 0,
      stages: { stage0: 0, stage1: 0, stage2: 0, stage3: 0, stage4: 0 }
    });
  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== REGISTRATIONS - SIMPLE VERSION =====
router.get('/registrations', async (req, res) => {
  console.log('📋 Registrations requested');
  try {
    // Simple query without populate
    const registrations = await RegistrationForm.find()
      .sort({ createdAt: -1 })
      .limit(20);
    
    console.log(`✅ Found ${registrations.length} registrations`);
    
    res.json({
      success: true,
      count: registrations.length,
      registrations: registrations
    });
  } catch (error) {
    console.error('❌ Registrations error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ===== CUSTOMERS =====
router.get('/customers', async (req, res) => {
  try {
    const customers = await User.find({ role: 'user' })
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json(customers);
  } catch (error) {
    console.error('❌ Customers error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== PETS =====
router.get('/pets', async (req, res) => {
  try {
    const pets = await Pet.find()
      .populate('owner', 'name email username mobile')
      .sort({ createdAt: -1 });
    
    res.json(pets);
  } catch (error) {
    console.error('❌ Pets error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;