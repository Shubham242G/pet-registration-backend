const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const RegistrationForm = require('../../models/RegsitrationForm');
const Pet = require('../../models/Pet');
const User = require('../../models/User');

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
    // Get basic counts - these should always work
    const totalCustomers = await User.countDocuments({ role: 'user' });
    const totalPets = await Pet.countDocuments();
    const totalRegistrations = await RegistrationForm.countDocuments();
    
    // Try to get completed registrations, but don't fail if field doesn't exist
    let completedRegistrations = 0;
    try {
      completedRegistrations = await RegistrationForm.countDocuments({ 
        registrationTriggered: true 
      });
    } catch (e) {
      console.log('⚠️ registrationTriggered field not found, using 0');
    }
    
    const pendingRegistrations = totalRegistrations - completedRegistrations;
    
    // Recent registrations
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    let recentRegistrations = 0;
    try {
      recentRegistrations = await RegistrationForm.countDocuments({
        createdAt: { $gte: thirtyDaysAgo }
      });
    } catch (e) {
      console.log('⚠️ recentRegistrations query failed, using 0');
    }
    
    // Stages - try to get, but don't fail
    let stage0 = 0, stage1 = 0, stage2 = 0, stage3 = 0, stage4 = 0;
    try {
      stage0 = await Pet.countDocuments({ registrationStage: 0 });
      stage1 = await Pet.countDocuments({ registrationStage: 1 });
      stage2 = await Pet.countDocuments({ registrationStage: 2 });
      stage3 = await Pet.countDocuments({ registrationStage: 3 });
      stage4 = await Pet.countDocuments({ registrationStage: 4 });
    } catch (e) {
      console.log('⚠️ Stage queries failed, using 0');
    }
    
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

// ==================== REGISTRATIONS (SAFE VERSION) ====================
router.get('/registrations', async (req, res) => {
  console.log('📋 Registrations requested - SAFE VERSION');
  try {
    // First, get registrations without populate (this should always work)
    const registrations = await RegistrationForm.find()
      .sort({ createdAt: -1 })
      .limit(50);
    
    console.log(`✅ Found ${registrations.length} registrations`);
    
    // If we have registrations, try to populate them
    let populatedRegistrations = [];
    if (registrations.length > 0) {
      try {
        // Try to populate with pet data
        populatedRegistrations = await RegistrationForm.find()
          .populate('pet')
          .sort({ createdAt: -1 })
          .limit(50);
        
        // Try to populate owner as well
        for (let reg of populatedRegistrations) {
          if (reg.pet && reg.pet._id) {
            try {
              const petWithOwner = await Pet.findById(reg.pet._id).populate('owner', 'name email username mobile');
              if (petWithOwner) {
                reg.pet = petWithOwner;
              }
            } catch (e) {
              console.log('⚠️ Could not populate owner for pet:', reg.pet._id);
            }
          }
        }
        
        console.log(`✅ Populated ${populatedRegistrations.length} registrations`);
      } catch (popError) {
        console.log('⚠️ Populate failed, sending unpopulated data');
        populatedRegistrations = registrations;
      }
    }
    
    res.json(populatedRegistrations.length > 0 ? populatedRegistrations : registrations);
  } catch (error) {
    console.error('❌ Error fetching registrations:', error);
    // Send empty array instead of crashing
    res.json([]);
  }
});

// ==================== PETS (SAFE VERSION) ====================
router.get('/pets', async (req, res) => {
  console.log('🐾 Pets requested - SAFE VERSION');
  try {
    const pets = await Pet.find()
      .sort({ createdAt: -1 })
      .limit(50);
    
    // Try to populate owner, but don't fail if it doesn't work
    let populatedPets = [];
    for (let pet of pets) {
      try {
        const petWithOwner = await Pet.findById(pet._id).populate('owner', 'name email username mobile');
        if (petWithOwner) {
          populatedPets.push(petWithOwner);
        } else {
          populatedPets.push(pet);
        }
      } catch (e) {
        populatedPets.push(pet);
        console.log('⚠️ Could not populate owner for pet:', pet._id);
      }
    }
    
    res.json(populatedPets);
  } catch (error) {
    console.error('❌ Error fetching pets:', error);
    res.json([]);
  }
});

// ==================== CUSTOMERS (SAFE VERSION) ====================
router.get('/customers', async (req, res) => {
  console.log('👥 Customers requested - SAFE VERSION');
  try {
    const customers = await User.find({ role: 'user' })
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(50);
    
    // Add pet counts for each customer
    const customersWithStats = [];
    for (let customer of customers) {
      try {
        const petCount = await Pet.countDocuments({ owner: customer._id });
        const registeredPets = await Pet.countDocuments({ 
          owner: customer._id, 
          registrationStage: 4 
        });
        customersWithStats.push({
          ...customer.toObject(),
          petCount,
          registeredPets: registeredPets || 0
        });
      } catch (e) {
        customersWithStats.push({
          ...customer.toObject(),
          petCount: 0,
          registeredPets: 0
        });
      }
    }
    
    res.json(customersWithStats);
  } catch (error) {
    console.error('❌ Error fetching customers:', error);
    res.json([]);
  }
});

// ==================== CUSTOMER BY ID ====================
router.get('/customers/:id', async (req, res) => {
  try {
    const customer = await User.findById(req.params.id).select('-password');
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    const pets = await Pet.find({ owner: customer._id });
    const registrations = await RegistrationForm.find({ 
      pet: { $in: pets.map(p => p._id) }
    });
    
    res.json({ customer, pets, registrations });
  } catch (error) {
    console.error('❌ Error fetching customer:', error);
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

// ==================== REGISTRATION DETAIL ====================
router.get('/registrations/:id', async (req, res) => {
  try {
    const registration = await RegistrationForm.findById(req.params.id);
    
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }
    
    // Try to populate pet and owner
    let populatedReg = registration.toObject();
    try {
      if (registration.pet) {
        const pet = await Pet.findById(registration.pet).populate('owner', 'name email username mobile');
        if (pet) {
          populatedReg.pet = pet;
        }
      }
    } catch (e) {
      console.log('⚠️ Could not populate pet for registration:', registration._id);
    }
    
    res.json(populatedReg);
  } catch (error) {
    console.error('❌ Error fetching registration:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== DOCUMENT MANAGEMENT ====================
router.get('/documents/pending', async (req, res) => {
  try {
    const registrations = await RegistrationForm.find({
      'documents.0': { $exists: true },
      registrationTriggered: false
    });
    
    const pendingDocuments = registrations.filter(reg => 
      reg.documents && reg.documents.length < 4
    );
    
    res.json(pendingDocuments);
  } catch (error) {
    console.error('❌ Error fetching pending documents:', error);
    res.json([]);
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
    res.json([]);
  }
});

module.exports = router;