// routes/admin/admin.js
const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const RegistrationForm = require('../../models/RegsitrationForm'); // Keep your filename
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
    
    // Safe check for registrationTriggered field
    let completedRegistrations = 0;
    try {
      completedRegistrations = await RegistrationForm.countDocuments({ 
        registrationTriggered: true 
      });
    } catch (e) {
      console.log('⚠️ registrationTriggered field may not exist in all documents');
    }
    
    const pendingRegistrations = totalRegistrations - completedRegistrations;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentRegistrations = await RegistrationForm.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    // Get registration stages from Pet schema
    const stage0 = await Pet.countDocuments({ registrationStage: 0 });
    const stage1 = await Pet.countDocuments({ registrationStage: 1 });
    const stage2 = await Pet.countDocuments({ registrationStage: 2 });
    const stage3 = await Pet.countDocuments({ registrationStage: 3 });
    const stage4 = await Pet.countDocuments({ registrationStage: 4 });
    
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

// ==================== CUSTOMER MANAGEMENT ====================
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

router.get('/customers/:id', async (req, res) => {
  try {
    const customer = await User.findById(req.params.id).select('-password');
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    const pets = await Pet.find({ owner: customer._id });
    const registrations = await RegistrationForm.find({ 
      pet: { $in: pets.map(p => p._id) }
    }).populate('pet');
    
    res.json({ customer, pets, registrations });
  } catch (error) {
    console.error('❌ Error fetching customer:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== PET MANAGEMENT ====================
router.get('/pets', async (req, res) => {
  console.log('🐾 Pets requested');
  try {
    const pets = await Pet.find()
      .populate('owner', 'name email username mobile')
      .sort({ createdAt: -1 });
    
    const petsWithStatus = await Promise.all(pets.map(async (pet) => {
      const registration = await RegistrationForm.findOne({ pet: pet._id });
      return {
        ...pet.toObject(),
        registrationStatus: registration ? {
          hasDocuments: registration.documents ? registration.documents.length : 0,
          totalDocuments: 4,
          registrationTriggered: registration.registrationTriggered || false,
          registrationTriggeredAt: registration.registrationTriggeredAt || null,
          isComplete: registration.isComplete || false
        } : null
      };
    }));
    
    res.json(petsWithStatus);
  } catch (error) {
    console.error('❌ Error fetching pets:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/pets/:id', async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id)
      .populate('owner', 'name email username mobile');
    
    if (!pet) {
      return res.status(404).json({ message: 'Pet not found' });
    }
    
    const registration = await RegistrationForm.findOne({ pet: pet._id });
    
    res.json({ pet, registration });
  } catch (error) {
    console.error('❌ Error fetching pet:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== REGISTRATION MANAGEMENT ====================
router.get('/registrations', async (req, res) => {
  console.log('📋 Registrations requested');
  try {
    const registrations = await RegistrationForm.find()
      .populate({
        path: 'pet',
        populate: { path: 'owner', select: 'name email username mobile' }
      })
      .sort({ createdAt: -1 });
    
    res.json(registrations);
  } catch (error) {
    console.error('❌ Error fetching registrations:', error);
    res.status(500).json({ 
      message: 'Failed to fetch registrations',
      error: error.message 
    });
  }
});

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

// ==================== REGISTRATION STAGE UPDATE ====================
router.put('/pets/:id/registration-stage', async (req, res) => {
  try {
    const { stage } = req.body;
    const pet = await Pet.findById(req.params.id);
    
    if (!pet) {
      return res.status(404).json({ message: 'Pet not found' });
    }
    
    pet.registrationStage = stage;
    
    const stageStatusMap = {
      0: 'not_started',
      1: 'documents_uploaded',
      2: 'form_submitted',
      3: 'awaiting_license',
      4: 'license_delivered'
    };
    pet.registrationStatus = stageStatusMap[stage] || 'not_started';
    
    await pet.save();
    
    if (stage === 4) {
      const registration = await RegistrationForm.findOne({ pet: pet._id });
      if (registration) {
        registration.isComplete = true;
        await registration.save();
      }
    }
    
    res.json({ message: `Registration stage updated to ${stage}`, pet });
  } catch (error) {
    console.error('❌ Error updating stage:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== LICENSE MANAGEMENT ====================
router.post('/pets/:id/license', async (req, res) => {
  try {
    const { licenseNumber, issueDate, expiryDate, licenseFile } = req.body;
    const pet = await Pet.findById(req.params.id);
    
    if (!pet) {
      return res.status(404).json({ message: 'Pet not found' });
    }
    
    pet.license = {
      number: licenseNumber,
      issuedAt: issueDate,
      expiresAt: expiryDate,
      fileData: licenseFile,
      issuedBy: req.user._id,
      issuedOn: new Date()
    };
    
    pet.registrationStage = 4;
    pet.registrationStatus = 'license_delivered';
    
    await pet.save();
    
    const registration = await RegistrationForm.findOne({ pet: pet._id });
    if (registration) {
      registration.isComplete = true;
      await registration.save();
    }
    
    res.json({ message: 'License issued successfully', license: pet.license });
  } catch (error) {
    console.error('❌ Error issuing license:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/pets/:id/license', async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id);
    
    if (!pet || !pet.license) {
      return res.status(404).json({ message: 'License not found' });
    }
    
    res.json(pet.license);
  } catch (error) {
    console.error('❌ Error fetching license:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== DOCUMENT MANAGEMENT ====================
router.get('/documents/pending', async (req, res) => {
  try {
    const registrations = await RegistrationForm.find({
      'documents.0': { $exists: true },
      registrationTriggered: false
    }).populate({
      path: 'pet',
      populate: { path: 'owner', select: 'name email' }
    });
    
    const pendingDocuments = registrations.filter(reg => 
      reg.documents && reg.documents.length < 4
    );
    
    res.json(pendingDocuments);
  } catch (error) {
    console.error('❌ Error fetching pending documents:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/registrations/:id/documents', async (req, res) => {
  try {
    const registration = await RegistrationForm.findById(req.params.id);
    
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }
    
    res.json(registration.documents || []);
  } catch (error) {
    console.error('❌ Error fetching documents:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== REGISTRATION TRIGGER ====================
router.post('/registrations/:id/trigger', async (req, res) => {
  try {
    const registration = await RegistrationForm.findById(req.params.id);
    
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }
    
    if (registration.registrationTriggered) {
      return res.status(400).json({ message: 'Registration already triggered' });
    }
    
    registration.registrationTriggered = true;
    registration.registrationTriggeredAt = new Date();
    registration.isComplete = true;
    await registration.save();
    
    res.json({ 
      message: 'Registration triggered successfully!',
      registration 
    });
  } catch (error) {
    console.error('❌ Error triggering registration:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== REGISTRATION COMPLETE TOGGLE ====================
router.put('/registrations/:id/complete', async (req, res) => {
  try {
    const { isComplete } = req.body;
    const registration = await RegistrationForm.findById(req.params.id);
    
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }
    
    registration.isComplete = isComplete;
    await registration.save();
    
    res.json({ 
      message: `Registration ${isComplete ? 'marked as complete' : 'marked as incomplete'}`,
      registration 
    });
  } catch (error) {
    console.error('❌ Error updating registration status:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;