// routes/admin/admin.js
const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const RegistrationForm = require('../../models/RegsitrationForm'); // Fixed typo!
const Pet = require('../../models/Pet');
const User = require('../../models/User');

// Apply admin middleware to all routes
router.use(auth);
router.use(requireRole('admin'));

// ==================== TEST ENDPOINT ====================
router.get('/test', (req, res) => {
  res.json({ 
    message: '✅ Admin routes working!',
    user: { id: req.user._id, role: req.user.role }
  });
});

// ==================== DASHBOARD STATS ====================
router.get('/dashboard/stats', async (req, res) => {
  console.log('📊 Dashboard stats requested');
  try {
    const totalCustomers = await User.countDocuments({ role: 'user' });
    const totalPets = await Pet.countDocuments();
    const totalRegistrations = await RegistrationForm.countDocuments();
    
    // ✅ FIX: Check if registrationTriggered exists in your data
    let completedRegistrations = 0;
    try {
      completedRegistrations = await RegistrationForm.countDocuments({ 
        registrationTriggered: true 
      });
    } catch (e) {
      console.log('⚠️ registrationTriggered field check failed, using 0');
    }
    
    const pendingRegistrations = totalRegistrations - completedRegistrations;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentRegistrations = await RegistrationForm.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    // ✅ Get registration stages from Pet schema
    const stage0 = await Pet.countDocuments({ registrationStage: 0 }) || 0;
    const stage1 = await Pet.countDocuments({ registrationStage: 1 }) || 0;
    const stage2 = await Pet.countDocuments({ registrationStage: 2 }) || 0;
    const stage3 = await Pet.countDocuments({ registrationStage: 3 }) || 0;
    const stage4 = await Pet.countDocuments({ registrationStage: 4 }) || 0;
    
    res.json({
      totalCustomers,
      totalPets,
      totalRegistrations,
      completedRegistrations,
      pendingRegistrations,
      recentRegistrations,
      stages: { stage0, stage1, stage2, stage3, stage4 }
    });
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({ 
      message: 'Failed to fetch dashboard stats',
      error: error.message 
    });
  }
});

// ==================== REGISTRATIONS ====================
router.get('/registrations', async (req, res) => {
  console.log('📋 Registrations requested');
  try {
    // ✅ FIX: Properly fetch registrations with pet data
    const registrations = await RegistrationForm.find()
      .populate({
        path: 'pet',
        populate: { path: 'owner', select: 'name email username mobile' }
      })
      .sort({ createdAt: -1 })
      .limit(100);
    
    // ✅ FIX: Format the response properly
    const formattedRegistrations = registrations.map(reg => ({
      _id: reg._id,
      pet: reg.pet,
      documents: reg.documents || [], // This is the array from RegistrationForm
      registrationTriggered: reg.registrationTriggered || false,
      registrationTriggeredAt: reg.registrationTriggeredAt,
      isComplete: reg.isComplete || false,
      paymentStatus: reg.paymentStatus,
      paymentId: reg.paymentId,
      paymentOrderId: reg.paymentOrderId,
      paymentAmount: reg.paymentAmount,
      createdAt: reg.createdAt,
      updatedAt: reg.updatedAt
    }));
    
    res.json(formattedRegistrations);
  } catch (error) {
    console.error('❌ Error fetching registrations:', error);
    res.status(500).json({ 
      message: 'Failed to fetch registrations',
      error: error.message 
    });
  }
});

// ==================== PETS ====================
router.get('/pets', async (req, res) => {
  console.log('🐾 Pets requested');
  try {
    const pets = await Pet.find()
      .populate('owner', 'name email username mobile')
      .sort({ createdAt: -1 });
    
    // ✅ FIX: Use the virtuals from Pet schema
    const petsWithStatus = pets.map(pet => {
      const petObj = pet.toObject();
      return {
        ...petObj,
        // These are from your Pet schema virtuals
        uploadedDocumentsCount: pet.uploadedDocumentsCount,
        requiredDocumentsCount: pet.requiredDocumentsCount,
        hasAllDocuments: pet.hasAllDocuments,
        registrationProgress: pet.registrationProgress,
        documents: pet.documents, // This uses the virtual getter
      };
    });
    
    res.json(petsWithStatus);
  } catch (error) {
    console.error('❌ Error fetching pets:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== CUSTOMERS ====================
router.get('/customers', async (req, res) => {
  console.log('👥 Customers requested');
  try {
    const customers = await User.find({ role: 'user' })
      .select('-password')
      .sort({ createdAt: -1 });
    
    const customersWithStats = await Promise.all(customers.map(async (customer) => {
      const petCount = await Pet.countDocuments({ owner: customer._id });
      const registeredPets = await Pet.countDocuments({ 
        owner: customer._id, 
        registrationStage: 4 
      });
      return {
        ...customer.toObject(),
        petCount,
        registeredPets
      };
    }));
    
    res.json(customersWithStats);
  } catch (error) {
    console.error('❌ Error fetching customers:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== SINGLE PET ====================
router.get('/pets/:id', async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id)
      .populate('owner', 'name email username mobile');
    
    if (!pet) {
      return res.status(404).json({ message: 'Pet not found' });
    }
    
    const registration = await RegistrationForm.findOne({ pet: pet._id });
    
    res.json({ 
      pet: pet.toObject(),
      registration: registration || null
    });
  } catch (error) {
    console.error('❌ Error fetching pet:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== REGISTRATION DETAIL ====================
router.get('/registrations/:id', async (req, res) => {
  try {
    const registration = await RegistrationForm.findById(req.params.id)
      .populate({
        path: 'pet',
        populate: { path: 'owner', select: 'name email username mobile' }
      });
    
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }
    
    res.json(registration);
  } catch (error) {
    console.error('❌ Error fetching registration:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;