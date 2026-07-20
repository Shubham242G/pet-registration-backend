const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const RegistrationForm = require('../../models/RegsitrationForm');
const Pet = require('../../models/Pet');
const User = require('../../models/User');

router.use(auth);
router.use(requireRole('admin'));

// ==================== TEST ====================
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
    const [
      totalCustomers,
      totalPets,
      totalRegistrations,
      completedRegistrations,
      recentRegistrations,
      stage0, stage1, stage2, stage3, stage4
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Pet.countDocuments(),
      RegistrationForm.countDocuments(),
      RegistrationForm.countDocuments({ registrationTriggered: true }).catch(() => 0),
      RegistrationForm.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }).catch(() => 0),
      Pet.countDocuments({ registrationStage: 0 }).catch(() => 0),
      Pet.countDocuments({ registrationStage: 1 }).catch(() => 0),
      Pet.countDocuments({ registrationStage: 2 }).catch(() => 0),
      Pet.countDocuments({ registrationStage: 3 }).catch(() => 0),
      Pet.countDocuments({ registrationStage: 4 }).catch(() => 0)
    ]);
    
    const pendingRegistrations = totalRegistrations - (completedRegistrations || 0);
    
    res.json({
      totalCustomers,
      totalPets,
      totalRegistrations,
      completedRegistrations: completedRegistrations || 0,
      pendingRegistrations,
      recentRegistrations: recentRegistrations || 0,
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const [total, customers] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.find({ role: 'user' })
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);
    
    // Get pet counts for each customer (batch query for efficiency)
    const customerIds = customers.map(c => c._id);
    const petCounts = await Pet.aggregate([
      { $match: { owner: { $in: customerIds } } },
      { $group: { _id: '$owner', count: { $sum: 1 } } }
    ]);
    
    const registeredPetCounts = await Pet.aggregate([
      { $match: { owner: { $in: customerIds }, registrationStage: 4 } },
      { $group: { _id: '$owner', count: { $sum: 1 } } }
    ]);
    
    // Create maps for quick lookup
    const petCountMap = {};
    petCounts.forEach(item => { petCountMap[item._id] = item.count; });
    
    const registeredPetMap = {};
    registeredPetCounts.forEach(item => { registeredPetMap[item._id] = item.count; });
    
    // Add counts to customers
    const customersWithStats = customers.map(customer => ({
      ...customer,
      petCount: petCountMap[customer._id] || 0,
      registeredPets: registeredPetMap[customer._id] || 0
    }));
    
    res.json({
      customers: customersWithStats,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('❌ Error fetching customers:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/customers/:id', async (req, res) => {
  try {
    const customer = await User.findById(req.params.id).select('-password').lean();
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    const [pets, registrations] = await Promise.all([
      Pet.find({ owner: customer._id }).lean(),
      RegistrationForm.find({ pet: { $in: await Pet.find({ owner: customer._id }).distinct('_id') } })
        .populate('pet')
        .lean()
    ]);
    
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const [total, pets] = await Promise.all([
      Pet.countDocuments(),
      Pet.find()
        .populate('owner', 'name email username mobile')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);
    
    // Get registration info for each pet
    const petIds = pets.map(p => p._id);
    const registrations = await RegistrationForm.find({ pet: { $in: petIds } }).lean();
    const registrationMap = {};
    registrations.forEach(reg => {
      registrationMap[reg.pet] = reg;
    });
    
    // Add registration status to pets
    const petsWithStatus = pets.map(pet => ({
      ...pet,
      registrationStatus: registrationMap[pet._id] ? {
        hasDocuments: registrationMap[pet._id].documents ? registrationMap[pet._id].documents.length : 0,
        totalDocuments: 4,
        registrationTriggered: registrationMap[pet._id].registrationTriggered || false,
        registrationTriggeredAt: registrationMap[pet._id].registrationTriggeredAt || null,
        isComplete: registrationMap[pet._id].isComplete || false
      } : null
    }));
    
    res.json({
      pets: petsWithStatus,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('❌ Error fetching pets:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/pets/:id', async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id)
      .populate('owner', 'name email username mobile')
      .lean();
    
    if (!pet) {
      return res.status(404).json({ message: 'Pet not found' });
    }
    
    const registration = await RegistrationForm.findOne({ pet: pet._id }).lean();
    
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const [total, registrations] = await Promise.all([
      RegistrationForm.countDocuments(),
      RegistrationForm.find()
        .populate({
          path: 'pet',
          populate: {
            path: 'owner',
            select: 'name email username mobile'
          }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);
    
    console.log(`✅ Found ${registrations.length} registrations (page ${page})`);
    
    res.json({
      registrations,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
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
        populate: {
          path: 'owner',
          select: 'name email username mobile'
        }
      })
      .lean();
    
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
    })
    .populate({
      path: 'pet',
      populate: { path: 'owner', select: 'name email' }
    })
    .lean();
    
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