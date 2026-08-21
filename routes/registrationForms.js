const express = require('express');
const router = express.Router();
const Pet = require('../models/Pet');
const RegistrationForm = require('../models/RegsitrationForm');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// ============================================
// HELPER FUNCTIONS
// ============================================

function getRequiredDocumentNames(pet) {
  const isGurgaon = pet?.city === 'gurgaon';
  const isFaridabad = pet?.city === 'faridabad';
  const isGhaziabadNoida = ['ghaziabad', 'noida'].includes(pet?.city);
  const isJaipur = pet?.city === 'jaipur';
  const isMumbaiThane = ['mumbai', 'thane'].includes(pet?.city);
  const ageInYears = (pet?.ageYears || 0) + (pet?.ageMonths || 0) / 12;

  if (isMumbaiThane) {
    return [
      'proofOfIdentity',
      'proofOfAddress',
      'vaccinationCertificate',
      'petPhotographs',
      'ownerPhoto',
      'antiRabiesCertificate'
    ];
  }

  if (isFaridabad) {
    return [
      'proofOfIdentity',
      'proofOfAddress',
      'vaccinationRecord',
      'petPhotographs',
      'sterilizationCertificate',
    ];
  }

  if (isJaipur) {
    return [
      'idProof',
      'vaccinationCard',
      'antiRabiesCertificate',
      'petPhoto'
    ];
  }

  const docs = [
    'antiRabiesCertificate',
    'idProof',
    'residenceProof',
    'ownerWithPetPhoto'
  ];

  if (isGurgaon) {
    docs.push('petPhoto', 'vaccinationCard', 'vaccinationCertificate');
    if (ageInYears >= 4) {
      docs.push('sterilizationCertificate');
    }
  }

  if (isGhaziabadNoida) {
    docs.push('ownerPhoto', 'petPhoto', 'ownerSignature');
  }

  return docs;
}

function hasAllDocuments(pet, registrationForm) {
  if (!pet || !registrationForm) return false;
  const requiredDocs = getRequiredDocumentNames(pet);
  const uploadedDocNames = registrationForm.documents?.map(doc => doc.documentName) || [];
  return requiredDocs.every(doc => uploadedDocNames.includes(doc));
}

// ============================================
// ✅ GET ALL REGISTRATIONS (WITH FULL DOCUMENTS)
// ============================================
router.get('/admin/registrations', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    console.log('🔍 Fetching all registrations with documents...');
    
    const registrations = await RegistrationForm.find({})
      .populate({
        path: 'pet',
        populate: {
          path: 'owner',
          select: 'name email phone'
        }
      })
      .sort({ createdAt: -1 });

    console.log(`📊 Found ${registrations.length} registrations`);

    // Transform the data - INCLUDING FULL DOCUMENT DATA
    const transformed = registrations.map(form => {
      const docData = form.documents?.map(doc => ({
        _id: doc._id,
        documentName: doc.documentName,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        fileData: doc.fileData || null, // ✅ Include fileData
        uploadedAt: doc.uploadedAt
      })) || [];

      return {
        _id: form._id,
        pet: form.pet ? {
          _id: form.pet._id,
          name: form.pet.name || 'Unknown',
          registrationStage: form.pet.registrationStage || 0,
          registrationStatus: form.pet.registrationStatus || 'not_started',
          owner: form.pet.owner ? {
            name: form.pet.owner.name || 'Unknown',
            email: form.pet.owner.email || 'Unknown'
          } : null
        } : null,
        documents: docData,
        registrationTriggered: form.registrationTriggered || false,
        registrationTriggeredAt: form.registrationTriggeredAt,
        createdAt: form.createdAt,
        isComplete: form.isComplete || false,
        paymentStatus: form.paymentStatus || 'pending'
      };
    });

    // Log how many documents have fileData
    let docsWithFileData = 0;
    let totalDocs = 0;
    transformed.forEach(reg => {
      if (reg.documents) {
        totalDocs += reg.documents.length;
        reg.documents.forEach(doc => {
          if (doc.fileData) docsWithFileData++;
        });
      }
    });
    console.log(`📄 Total documents: ${totalDocs}, With fileData: ${docsWithFileData}`);

    res.json(transformed);

  } catch (error) {
    console.error('❌ Registrations fetch error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ✅ GET PENDING DOCUMENTS (WITH FULL DOCUMENTS)
// ============================================
router.get('/admin/pending-documents', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    console.log('📋 Fetching pending documents...');

    const registrations = await RegistrationForm.find({})
      .populate({
        path: 'pet',
        populate: {
          path: 'owner',
          select: 'name email'
        }
      });

    const pendingDocs = registrations
      .filter(form => {
        if (!form.pet) return false;
        const requiredDocs = getRequiredDocumentNames(form.pet);
        const uploadedDocs = form.documents?.map(d => d.documentName) || [];
        return requiredDocs.some(doc => !uploadedDocs.includes(doc));
      })
      .map(form => {
        const requiredDocs = getRequiredDocumentNames(form.pet);
        const uploadedDocs = form.documents?.map(d => d.documentName) || [];
        const missingDocuments = requiredDocs.filter(doc => !uploadedDocs.includes(doc));

        const fullDocuments = form.documents?.map(doc => ({
          _id: doc._id,
          documentName: doc.documentName,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType,
          fileData: doc.fileData || null,
          uploadedAt: doc.uploadedAt
        })) || [];

        return {
          _id: form._id,
          pet: form.pet ? {
            _id: form.pet._id,
            name: form.pet.name || 'Unknown',
            owner: form.pet.owner ? {
              name: form.pet.owner.name || 'Unknown',
              email: form.pet.owner.email || 'Unknown'
            } : null
          } : null,
          documents: fullDocuments,
          missingDocuments: missingDocuments,
          uploadedDocumentsCount: form.documents?.length || 0
        };
      });

    console.log(`📋 Found ${pendingDocs.length} pets with pending documents`);
    res.json(pendingDocs);

  } catch (error) {
    console.error('❌ Pending documents error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ✅ GET SINGLE PET DETAILS (WITH FULL DOCUMENTS)
// ============================================
router.get('/admin/pets/:petId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    console.log(`🔍 Fetching pet details for ${req.params.petId}`);

    const pet = await Pet.findById(req.params.petId)
      .populate('owner', 'name email phone');

    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }

    const registrationForm = await RegistrationForm.findOne({ pet: pet._id });
    const requiredDocs = getRequiredDocumentNames(pet);
    const uploadedDocs = registrationForm?.documents?.map(d => d.documentName) || [];
    const missingDocs = requiredDocs.filter(doc => !uploadedDocs.includes(doc));

    const fullDocuments = registrationForm?.documents?.map(doc => ({
      _id: doc._id,
      documentName: doc.documentName,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      fileData: doc.fileData || null,
      uploadedAt: doc.uploadedAt
    })) || [];

    console.log(`✅ Pet found: ${pet.name}, Documents: ${fullDocuments.length}/${requiredDocs.length}`);

    res.json({
      success: true,
      data: {
        pet: {
          _id: pet._id,
          name: pet.name,
          species: pet.species,
          breed: pet.breed,
          ageYears: pet.ageYears,
          ageMonths: pet.ageMonths,
          gender: pet.gender,
          city: pet.city,
          profilePicture: pet.profilePicture,
          registrationStage: pet.registrationStage || 0,
          registrationStatus: pet.registrationStatus || 'not_started',
          owner: pet.owner ? {
            _id: pet.owner._id,
            name: pet.owner.name,
            email: pet.owner.email,
            phone: pet.owner.phone
          } : null
        },
        registration: registrationForm ? {
          _id: registrationForm._id,
          documents: fullDocuments,
          registrationTriggered: registrationForm.registrationTriggered || false,
          registrationTriggeredAt: registrationForm.registrationTriggeredAt,
          isComplete: registrationForm.isComplete || false,
          paymentStatus: registrationForm.paymentStatus || 'pending',
          paymentAmount: registrationForm.paymentAmount
        } : null,
        documents: {
          required: requiredDocs,
          uploaded: uploadedDocs,
          missing: missingDocs,
          hasAll: missingDocs.length === 0
        }
      }
    });

  } catch (error) {
    console.error('❌ Pet details error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ✅ GET DASHBOARD STATS
// ============================================
router.get('/admin/stats', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    console.log('📊 Fetching dashboard stats...');

    const totalCustomers = await User.countDocuments({ role: 'user' });
    const totalPets = await Pet.countDocuments();
    
    const registrations = await RegistrationForm.find({});
    const totalRegistrations = registrations.length;
    const completedRegistrations = registrations.filter(r => r.isComplete).length;
    const pendingRegistrations = registrations.filter(r => !r.isComplete).length;
    const recentRegistrations = registrations.filter(r => {
      const days = (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return days <= 7;
    }).length;

    const pets = await Pet.find({});
    const stages = {
      stage0: pets.filter(p => p.registrationStage === 0).length,
      stage1: pets.filter(p => p.registrationStage === 1).length,
      stage2: pets.filter(p => p.registrationStage === 2).length,
      stage3: pets.filter(p => p.registrationStage === 3).length,
      stage4: pets.filter(p => p.registrationStage === 4).length,
    };

    console.log('✅ Stats fetched:', { totalCustomers, totalPets, totalRegistrations });

    res.json({
      totalCustomers,
      totalPets,
      totalRegistrations,
      completedRegistrations,
      pendingRegistrations,
      recentRegistrations,
      stages
    });

  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ✅ UPDATE REGISTRATION STAGE
// ============================================
router.put('/admin/pets/:petId/stage', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    const { petId } = req.params;
    const { stage } = req.body;

    console.log(`🔄 Updating pet ${petId} to stage ${stage}`);

    if (stage < 0 || stage > 4) {
      return res.status(400).json({ success: false, message: 'Invalid stage. Must be 0-4' });
    }

    const pet = await Pet.findById(petId);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }

    pet.registrationStage = stage;
    
    const statusMap = {
      0: 'not_started',
      1: 'documents_uploaded',
      2: 'form_submitted',
      3: 'awaiting_license',
      4: 'license_delivered'
    };
    pet.registrationStatus = statusMap[stage] || 'not_started';

    if (stage === 4) {
      const registrationForm = await RegistrationForm.findOne({ pet: pet._id });
      if (registrationForm) {
        registrationForm.isComplete = true;
        registrationForm.registrationTriggered = true;
        await registrationForm.save();
        console.log('✅ Registration marked as complete');
      }
    }

    await pet.save();
    console.log(`✅ Pet stage updated to ${stage}`);

    res.json({
      success: true,
      message: `Pet stage updated to ${stage}`,
      data: {
        petId: pet._id,
        name: pet.name,
        registrationStage: pet.registrationStage,
        registrationStatus: pet.registrationStatus
      }
    });

  } catch (error) {
    console.error('❌ Update stage error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ✅ GET ALL PETS
// ============================================
router.get('/admin/pets', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    console.log('📋 Fetching all pets...');
    const pets = await Pet.find({})
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${pets.length} pets`);
    res.json({
      success: true,
      data: pets
    });

  } catch (error) {
    console.error('❌ Pets fetch error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ✅ GET ALL USERS
// ============================================
router.get('/admin/users', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    console.log('📋 Fetching all users...');
    const users = await User.find({ role: 'user' })
      .select('-password')
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${users.length} users`);
    res.json({
      success: true,
      data: users
    });

  } catch (error) {
    console.error('❌ Users fetch error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ✅ UPLOAD DOCUMENT
// ============================================
router.post('/:petId/documents', auth, async (req, res) => {
  try {
    const { documentName, fileData, fileName, fileSize, mimeType } = req.body;

    console.log('📄 Uploading document:', documentName, 'for pet:', req.params.petId);

    if (!documentName || !fileData || !fileName || !fileSize || !mimeType) {
      return res.status(400).json({ 
        success: false,
        message: 'All fields are required' 
      });
    }

    let pet;
    if (req.user.role === 'admin') {
      pet = await Pet.findById(req.params.petId);
    } else {
      pet = await Pet.findOne({
        _id: req.params.petId,
        owner: req.user._id
      });
    }

    if (!pet) {
      return res.status(404).json({ 
        success: false,
        message: 'Pet not found' 
      });
    }

    const requiredDocs = getRequiredDocumentNames(pet);
    if (!requiredDocs.includes(documentName)) {
      return res.status(400).json({
        success: false,
        message: `Invalid document name: ${documentName}. Allowed: ${requiredDocs.join(', ')}`
      });
    }

    let registrationForm = await RegistrationForm.findOne({ pet: pet._id });
    if (!registrationForm) {
      registrationForm = new RegistrationForm({
        pet: pet._id,
        documents: [],
        registrationTriggered: false,
        isComplete: false,
        paymentStatus: 'pending'
      });
    }

    const docObj = {
      documentName,
      fileData,
      fileName,
      fileSize,
      mimeType,
      uploadedAt: new Date()
    };

    const existingDocIndex = registrationForm.documents.findIndex(
      doc => doc.documentName === documentName
    );

    if (existingDocIndex !== -1) {
      registrationForm.documents[existingDocIndex] = docObj;
    } else {
      registrationForm.documents.push(docObj);
    }

    await registrationForm.save();

    const updateData = {
      [`${documentName}.fileData`]: fileData,
      [`${documentName}.fileName`]: fileName,
      [`${documentName}.fileSize`]: fileSize,
      [`${documentName}.mimeType`]: mimeType,
      [`${documentName}.uploadedAt`]: new Date()
    };
    await Pet.findByIdAndUpdate(pet._id, updateData);

    const hasAllDocs = hasAllDocuments(pet, registrationForm);

    if (hasAllDocs && pet.registrationStatus === 'not_started') {
      pet.registrationStatus = 'documents_uploaded';
      pet.registrationStage = 1;
      await pet.save();
    }

    res.json({
      success: true,
      message: 'Document uploaded successfully',
      document: {
        documentName,
        fileName,
        fileSize,
        mimeType,
        uploadedAt: new Date()
      },
      registration: {
        uploadedDocumentsCount: registrationForm.documents.length,
        requiredDocumentsCount: requiredDocs.length,
        hasAllDocuments: hasAllDocs
      }
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload document'
    });
  }
});

// ============================================
// ✅ DELETE DOCUMENT
// ============================================
router.delete('/:petId/documents/:documentName', auth, async (req, res) => {
  try {
    const { petId, documentName } = req.params;

    let pet;
    if (req.user.role === 'admin') {
      pet = await Pet.findById(petId);
    } else {
      pet = await Pet.findOne({
        _id: petId,
        owner: req.user._id
      });
    }

    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }

    const registrationForm = await RegistrationForm.findOne({ pet: pet._id });
    if (!registrationForm) {
      return res.status(404).json({ success: false, message: 'Registration form not found' });
    }

    registrationForm.documents = registrationForm.documents.filter(
      doc => doc.documentName !== documentName
    );
    await registrationForm.save();

    const updateData = {
      [`${documentName}.fileData`]: null,
      [`${documentName}.fileName`]: null,
      [`${documentName}.fileSize`]: null,
      [`${documentName}.mimeType`]: null,
      [`${documentName}.uploadedAt`]: null
    };
    await Pet.findByIdAndUpdate(pet._id, updateData);

    const requiredDocs = getRequiredDocumentNames(pet);
    const hasAllDocs = hasAllDocuments(pet, registrationForm);

    if (!hasAllDocs && pet.registrationStatus === 'documents_uploaded') {
      pet.registrationStatus = 'not_started';
      pet.registrationStage = 0;
      await pet.save();
    }

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ✅ TRIGGER REGISTRATION
// ============================================
router.post('/:petId/trigger-registration', auth, async (req, res) => {
  try {
    const { petId } = req.params;
    const { paymentVerified, paidAmount, tagDeliveryOption, tagDeliveryCost } = req.body;

    let pet;
    if (req.user.role === 'admin') {
      pet = await Pet.findById(petId);
    } else {
      pet = await Pet.findOne({
        _id: petId,
        owner: req.user._id
      });
    }

    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }

    const registrationForm = await RegistrationForm.findOne({ pet: pet._id });
    if (!registrationForm) {
      return res.status(404).json({ success: false, message: 'Registration form not found' });
    }

    const requiredDocs = getRequiredDocumentNames(pet);
    const hasAllDocs = hasAllDocuments(pet, registrationForm);

    if (!hasAllDocs) {
      return res.status(400).json({
        success: false,
        message: 'All required documents must be uploaded'
      });
    }

    if (!paymentVerified) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification required'
      });
    }

    const cityPrices = {
      ghaziabad: 1599,
      gurgaon: 1699,
      delhi: 999,
      noida: 999,
      faridabad: 999,
      jaipur: 1699,
      mumbai: 999,
      thane: 999,
    };

    let amount = cityPrices[pet.city] || 999;
    if (tagDeliveryOption === 'deliver_to_home' && tagDeliveryCost) {
      amount += tagDeliveryCost;
    }

    const finalAmount = paidAmount || amount;

    registrationForm.registrationTriggered = true;
    registrationForm.registrationTriggeredAt = new Date();
    registrationForm.isComplete = true;
    registrationForm.paymentStatus = 'completed';
    registrationForm.paymentAmount = finalAmount;
    await registrationForm.save();

    pet.registrationTriggered = true;
    pet.registrationTriggeredAt = new Date();
    pet.registrationStatus = 'form_submitted';
    pet.registrationStage = 2;
    pet.paymentStatus = 'completed';
    pet.paymentAmount = finalAmount;
    pet.paymentDate = new Date();

    if (tagDeliveryOption) {
      pet.tagDelivery = {
        option: tagDeliveryOption,
        cost: tagDeliveryCost || 0
      };
    }
    await pet.save();

    res.json({
      success: true,
      message: 'Registration submitted successfully!'
    });
  } catch (error) {
    console.error('❌ Trigger registration error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ✅ GET REGISTRATION STATUS
// ============================================
router.get('/:petId/status', auth, async (req, res) => {
  try {
    const { petId } = req.params;
    
    let pet;
    if (req.user.role === 'admin') {
      pet = await Pet.findById(petId);
    } else {
      pet = await Pet.findOne({
        _id: petId,
        owner: req.user._id
      });
    }

    if (!pet) {
      return res.status(404).json({ message: 'Pet not found' });
    }

    const registrationForm = await RegistrationForm.findOne({ pet: pet._id });
    const requiredDocs = getRequiredDocumentNames(pet);

    let hasAllDocs = false;
    if (registrationForm) {
      hasAllDocs = hasAllDocuments(pet, registrationForm);
    }

    res.json({
      success: true,
      data: {
        pet: {
          _id: pet._id,
          name: pet.name,
          city: pet.city,
          registrationStatus: pet.registrationStatus || 'not_started',
          registrationStage: pet.registrationStage || 0
        },
        registration: {
          hasRegistrationForm: !!registrationForm,
          uploadedDocumentsCount: registrationForm?.documents?.length || 0,
          requiredDocumentsCount: requiredDocs.length,
          requiredDocuments: requiredDocs,
          uploadedDocuments: registrationForm?.documents?.map(d => d.documentName) || [],
          hasAllDocuments: hasAllDocs,
          registrationTriggered: registrationForm?.registrationTriggered || false,
          isComplete: registrationForm?.isComplete || false,
          paymentStatus: registrationForm?.paymentStatus || 'pending',
          paymentAmount: registrationForm?.paymentAmount || null
        }
      }
    });
  } catch (error) {
    console.error('❌ Status error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// ✅ GET DOCUMENT REQUIREMENTS BY CITY
// ============================================
router.get('/requirements/:city', auth, async (req, res) => {
  try {
    const { city } = req.params;
    const tempPet = { city };
    if (city === 'gurgaon') {
      tempPet.ageYears = 5;
      tempPet.ageMonths = 0;
    }

    const requiredDocs = getRequiredDocumentNames(tempPet);

    const displayNames = {
      antiRabiesCertificate: 'Anti-Rabies Certificate',
      idProof: 'ID Proof',
      residenceProof: 'Residence Proof',
      ownerWithPetPhoto: 'Owner with Pet Photo',
      petPhoto: 'Pet Photo',
      vaccinationCard: 'Vaccination Card',
      vaccinationCertificate: 'Vaccination Certificate',
      sterilizationCertificate: 'Sterilization Certificate',
      ownerPhoto: 'Owner Photo',
      ownerSignature: 'Owner Signature',
      proofOfIdentity: 'Proof of Identity',
      proofOfAddress: 'Proof of Address',
      vaccinationRecord: 'Vaccination Record',
      petPhotographs: 'Pet Photographs',
      aadharCard: 'Aadhar Card',
      residentialProof: 'Residential Proof',
      petPhotograph: 'Pet Photograph',
      antiRabiesLeptoCertificate: 'Anti-Rabies & Lepto Certificate',
    };

    const documents = requiredDocs.map(doc => ({
      key: doc,
      label: displayNames[doc] || doc,
      required: true
    }));

    res.json({
      city,
      requiredCount: requiredDocs.length,
      documents,
      isGurgaon: city === 'gurgaon',
      isFaridabad: city === 'faridabad',
      isGhaziabadNoida: ['ghaziabad', 'noida'].includes(city)
    });
  } catch (error) {
    console.error('❌ Requirements error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🧪 TEST - Check documents in database
// ============================================
router.get('/admin/test-docs', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    console.log('🧪 TEST: Checking documents in database...');
    
    const registrations = await RegistrationForm.find({}).lean();
    
    const result = {
      totalRegistrations: registrations.length,
      registrations: registrations.map(reg => ({
        _id: reg._id,
        petId: reg.pet,
        documentsCount: reg.documents?.length || 0,
        documents: reg.documents?.map(doc => ({
          documentName: doc.documentName,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType,
          hasFileData: !!doc.fileData,
          fileDataLength: doc.fileData?.length || 0,
          fileDataPreview: doc.fileData ? doc.fileData.substring(0, 50) + '...' : 'null'
        })) || []
      }))
    };

    console.log(`🧪 Found ${registrations.length} registrations`);
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Test error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;