// routes/registration.js
const express = require('express');
const router = express.Router();
const Pet = require('../models/Pet');
const RegistrationForm = require('../models/RegsitrationForm');
const { auth } = require('../middleware/auth');

// Helper function to calculate required documents count
function getRequiredDocumentsCount(pet) {
  const isGurgaon = pet.city === 'gurgaon';
  const isFaridabad = pet.city === 'faridabad';
  const ageInYears = (pet.ageYears || 0) + (pet.ageMonths || 0) / 12;
  
  if (isFaridabad) {
    return 6; // Proof of Identity, Proof of Address, Vaccination Record, Pet Photographs, Sterilization Certificate, Microchip Details
  }
  
  let count = 4; // Base: antiRabies, idProof, residenceProof, ownerWithPetPhoto
  
  if (isGurgaon) {
    count += 3; // petPhoto, vaccinationCard, vaccinationCertificate
    if (ageInYears >= 4) {
      count += 1; // sterilizationCertificate
    }
  }
  
  return count;
}

// Helper function to get required document names
function getRequiredDocumentNames(pet) {
  const isGurgaon = pet.city === 'gurgaon';
  const isFaridabad = pet.city === 'faridabad';
  const ageInYears = (pet.ageYears || 0) + (pet.ageMonths || 0) / 12;
  
  // Faridabad docs
  if (isFaridabad) {
    return [
      'proofOfIdentity',
      'proofOfAddress',
      'vaccinationRecord',
      'petPhotographs',
      'sterilizationCertificate',
      'microchipDetails'
    ];
  }
  
  // Base docs for all cities
  const docs = [
    'antiRabiesCertificate', 
    'idProof', 
    'residenceProof', 
    'ownerWithPetPhoto'
  ];
  
  // Gurgaon additional docs
  if (isGurgaon) {
    docs.push('petPhoto', 'vaccinationCard', 'vaccinationCertificate');
    if (ageInYears >= 4) {
      docs.push('sterilizationCertificate');
    }
  }
  
  return docs;
}

// Get registration status
router.get('/:petId/status', auth, async (req, res) => {
  try {
    const pet = await Pet.findOne({ 
      _id: req.params.petId, 
      owner: req.user._id 
    });
    
    if (!pet) {
      return res.status(404).json({ message: 'Pet not found' });
    }
    
    // Get or create registration form
    let registrationForm = await RegistrationForm.findOne({ pet: pet._id });
    if (!registrationForm) {
      registrationForm = new RegistrationForm({
        pet: pet._id,
        documents: [],
        registrationTriggered: false,
        isComplete: false,
        paymentStatus: 'pending'
      });
      await registrationForm.save();
    }
    
    const requiredCount = getRequiredDocumentsCount(pet);
    const requiredDocs = getRequiredDocumentNames(pet);
    const uploadedDocNames = registrationForm.documents.map(doc => doc.documentName);
    const hasAllDocs = requiredDocs.every(doc => uploadedDocNames.includes(doc));
    
    res.json({
      pet: pet,
      documents: registrationForm.documents || [],
      uploadedDocumentsCount: registrationForm.documents.length || 0,
      requiredDocumentsCount: requiredCount,
      hasAllDocuments: hasAllDocs,
      registrationTriggered: registrationForm.registrationTriggered || false,
      registrationTriggeredAt: registrationForm.registrationTriggeredAt || null,
      registrationStatus: registrationForm.isComplete ? 'form_submitted' : 'not_started',
      tagDelivery: pet.tagDelivery,
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Upload document
router.post('/:petId/documents', auth, async (req, res) => {
  try {
    const { documentName, fileData, fileName, fileSize, mimeType } = req.body;
    
    console.log('📄 Uploading document:', documentName);
    
    const pet = await Pet.findOne({ 
      _id: req.params.petId, 
      owner: req.user._id 
    });
    
    if (!pet) {
      return res.status(404).json({ message: 'Pet not found' });
    }
    
    // Get or create registration form
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
    
    // Check if document already exists
    const existingDocIndex = registrationForm.documents.findIndex(
      doc => doc.documentName === documentName
    );
    
    if (existingDocIndex !== -1) {
      // Update existing document
      registrationForm.documents[existingDocIndex] = {
        documentName,
        fileData,
        fileName,
        fileSize,
        mimeType,
        uploadedAt: new Date()
      };
    } else {
      // Add new document
      registrationForm.documents.push({
        documentName,
        fileData,
        fileName,
        fileSize,
        mimeType,
        uploadedAt: new Date()
      });
    }
    
    await registrationForm.save();
    
    // Check if all required docs are uploaded
    const requiredDocs = getRequiredDocumentNames(pet);
    const uploadedDocNames = registrationForm.documents.map(doc => doc.documentName);
    const hasAllDocs = requiredDocs.every(doc => uploadedDocNames.includes(doc));
    
    res.json({
      message: 'Document uploaded successfully',
      pet: pet,
      uploadedDocumentsCount: registrationForm.documents.length,
      hasAllDocuments: hasAllDocs,
      registrationTriggered: registrationForm.registrationTriggered
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete document
router.delete('/:petId/documents/:documentName', auth, async (req, res) => {
  try {
    const { petId, documentName } = req.params;
    
    console.log('🗑️ Deleting document:', documentName);
    
    const pet = await Pet.findOne({ 
      _id: petId, 
      owner: req.user._id 
    });
    
    if (!pet) {
      return res.status(404).json({ message: 'Pet not found' });
    }
    
    // Get registration form
    const registrationForm = await RegistrationForm.findOne({ pet: pet._id });
    if (!registrationForm) {
      return res.status(404).json({ message: 'Registration form not found' });
    }
    
    // Remove document
    registrationForm.documents = registrationForm.documents.filter(
      doc => doc.documentName !== documentName
    );
    
    await registrationForm.save();
    
    // Check if all required docs are uploaded
    const requiredDocs = getRequiredDocumentNames(pet);
    const uploadedDocNames = registrationForm.documents.map(doc => doc.documentName);
    const hasAllDocs = requiredDocs.every(doc => uploadedDocNames.includes(doc));
    
    res.json({ 
      message: 'Document deleted successfully',
      pet: pet,
      uploadedDocumentsCount: registrationForm.documents.length,
      hasAllDocuments: hasAllDocs,
      registrationTriggered: registrationForm.registrationTriggered || false
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Trigger registration
router.post('/:petId/trigger-registration', auth, async (req, res) => {
  try {
    const { petId } = req.params;
    const { paymentVerified, paidAmount, tagDeliveryOption, tagDeliveryCost } = req.body;
    
    const pet = await Pet.findOne({ 
      _id: petId, 
      owner: req.user._id 
    });
    
    if (!pet) {
      return res.status(404).json({ message: 'Pet not found' });
    }
    
    // Get registration form
    const registrationForm = await RegistrationForm.findOne({ pet: pet._id });
    if (!registrationForm) {
      return res.status(404).json({ message: 'Registration form not found' });
    }
    
    // Check if all required docs are uploaded
    const requiredDocs = getRequiredDocumentNames(pet);
    const uploadedDocNames = registrationForm.documents.map(doc => doc.documentName);
    const hasAllDocs = requiredDocs.every(doc => uploadedDocNames.includes(doc));
    
    if (!hasAllDocs) {
      return res.status(400).json({ 
        message: `All required documents must be uploaded (${registrationForm.documents.length}/${requiredDocs.length})` 
      });
    }
    
    if (!paymentVerified) {
      return res.status(400).json({ message: 'Payment verification required' });
    }
    
    // Update registration form
    registrationForm.registrationTriggered = true;
    registrationForm.registrationTriggeredAt = new Date();
    registrationForm.isComplete = true;
    registrationForm.paymentStatus = 'completed';
    registrationForm.paymentAmount = paidAmount || 999;
    
    await registrationForm.save();
    
    // Update pet
    pet.registrationTriggered = true;
    pet.registrationTriggeredAt = new Date();
    pet.registrationStatus = 'form_submitted';
    pet.registrationStage = 2;
    pet.paymentStatus = 'completed';
    pet.paymentAmount = paidAmount || 999;
    
    if (tagDeliveryOption) {
      pet.tagDelivery = {
        option: tagDeliveryOption,
        cost: tagDeliveryCost || 0
      };
    }
    
    await pet.save();
    
    res.json({
      success: true,
      message: 'Registration submitted successfully! You will receive the license within 7-10 business days.',
      pet: {
        id: pet._id,
        name: pet.name,
        city: pet.city,
        registrationStatus: pet.registrationStatus,
        registrationStage: pet.registrationStage,
        registrationTriggered: pet.registrationTriggered,
        tagDelivery: pet.tagDelivery,
      }
    });
  } catch (error) {
    console.error('Trigger registration error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;