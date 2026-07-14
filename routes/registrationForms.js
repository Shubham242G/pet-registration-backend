// routes/registration.js
const express = require('express');
const router = express.Router();
const Pet = require('../models/Pet');
const RegistrationForm = require('../models/RegsitrationForm');
const { auth } = require('../middleware/auth');

// Helper function to get required document names for each city
function getRequiredDocumentNames(pet) {
  const isGurgaon = pet.city === 'gurgaon';
  const isFaridabad = pet.city === 'faridabad';
  const isGhaziabadNoida = ['ghaziabad', 'noida'].includes(pet.city);
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
  
  // Ghaziabad & Noida additional docs
  if (isGhaziabadNoida) {
    docs.push('ownerPhoto', 'petPhoto', 'ownerSignature');
    // Note: vaccinationCard is already in base docs
  }
  
  return docs;
}

// Helper function to get required documents count
function getRequiredDocumentsCount(pet) {
  return getRequiredDocumentNames(pet).length;
}

// Helper function to check if all documents are uploaded
function hasAllDocuments(pet, registrationForm) {
  const requiredDocs = getRequiredDocumentNames(pet);
  const uploadedDocNames = registrationForm.documents.map(doc => doc.documentName);
  return requiredDocs.every(doc => uploadedDocNames.includes(doc));
}

// Get registration status
router.post('/:petId/documents', auth, async (req, res) => {
  try {
    const { documentName, fileData, fileName, fileSize, mimeType } = req.body;
    
    console.log('📄 Uploading document:', documentName, 'for pet:', req.params.petId);
    console.log('📄 Request body:', { documentName, fileName, fileSize, mimeType });
    
    // Validate required fields
    if (!documentName) {
      return res.status(400).json({ message: 'documentName is required' });
    }
    if (!fileData) {
      return res.status(400).json({ message: 'fileData is required' });
    }
    if (!fileName) {
      return res.status(400).json({ message: 'fileName is required' });
    }
    if (!fileSize) {
      return res.status(400).json({ message: 'fileSize is required' });
    }
    if (!mimeType) {
      return res.status(400).json({ message: 'mimeType is required' });
    }
    
    // Validate fileData format
    if (typeof fileData !== 'string' || !fileData.startsWith('data:')) {
      return res.status(400).json({ 
        message: 'Invalid fileData format. Must be a base64 string starting with "data:"' 
      });
    }
    
    const pet = await Pet.findOne({ 
      _id: req.params.petId, 
      owner: req.user._id 
    });
    
    if (!pet) {
      return res.status(404).json({ message: 'Pet not found' });
    }
    
    // ✅ ALLOW optional documents - don't reject if not in required list
    const requiredDocs = getRequiredDocumentNames(pet);
    
    // List of ALL allowed document names (including optional ones)
    const allAllowedDocs = [
      ...requiredDocs,
      // Optional documents that can be uploaded
      'vaccinationCard', // Optional for Ghaziabad/Noida
    ];
    
    // Check if document is allowed (either required or optional)
    if (!allAllowedDocs.includes(documentName)) {
      return res.status(400).json({ 
        message: `Invalid document name: ${documentName}. Allowed: ${allAllowedDocs.join(', ')}` 
      });
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
    
    // Also update in Pet model
    const updateData = {
      [`${documentName}.fileData`]: fileData,
      [`${documentName}.fileName`]: fileName,
      [`${documentName}.fileSize`]: fileSize,
      [`${documentName}.mimeType`]: mimeType,
      [`${documentName}.uploadedAt`]: new Date()
    };
    await Pet.findByIdAndUpdate(pet._id, updateData);
    
    // Check if all required docs are uploaded
    const hasAllDocs = hasAllDocuments(pet, registrationForm);
    
    // If all documents uploaded, update pet status
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
        hasAllDocuments: hasAllDocs,
        registrationTriggered: registrationForm.registrationTriggered,
        isComplete: registrationForm.isComplete
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to upload document'
    });
  }
});

// Upload document
router.post('/:petId/documents', auth, async (req, res) => {
  try {
    const { documentName, fileData, fileName, fileSize, mimeType } = req.body;
    
    console.log('📄 Uploading document:', documentName, 'for pet:', req.params.petId);
    console.log('📄 Request body:', { documentName, fileName, fileSize, mimeType });
    
    // Validate required fields
    if (!documentName) {
      return res.status(400).json({ message: 'documentName is required' });
    }
    if (!fileData) {
      return res.status(400).json({ message: 'fileData is required' });
    }
    if (!fileName) {
      return res.status(400).json({ message: 'fileName is required' });
    }
    if (!fileSize) {
      return res.status(400).json({ message: 'fileSize is required' });
    }
    if (!mimeType) {
      return res.status(400).json({ message: 'mimeType is required' });
    }
    
    // Validate fileData format
    if (typeof fileData !== 'string' || !fileData.startsWith('data:')) {
      return res.status(400).json({ 
        message: 'Invalid fileData format. Must be a base64 string starting with "data:"' 
      });
    }
    
    const pet = await Pet.findOne({ 
      _id: req.params.petId, 
      owner: req.user._id 
    });
    
    if (!pet) {
      return res.status(404).json({ message: 'Pet not found' });
    }
    
    // Validate document name based on city
    const requiredDocs = getRequiredDocumentNames(pet);
    if (!requiredDocs.includes(documentName)) {
      return res.status(400).json({ 
        message: `Invalid document name for ${pet.city}. Required: ${requiredDocs.join(', ')}` 
      });
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
    
    // Also update in Pet model
    const updateData = {
      [`${documentName}.fileData`]: fileData,
      [`${documentName}.fileName`]: fileName,
      [`${documentName}.fileSize`]: fileSize,
      [`${documentName}.mimeType`]: mimeType,
      [`${documentName}.uploadedAt`]: new Date()
    };
    await Pet.findByIdAndUpdate(pet._id, updateData);
    
    // Check if all required docs are uploaded
    const hasAllDocs = hasAllDocuments(pet, registrationForm);
    
    // If all documents uploaded, update pet status
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
        hasAllDocuments: hasAllDocs,
        registrationTriggered: registrationForm.registrationTriggered,
        isComplete: registrationForm.isComplete
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to upload document'
    });
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
    
    // Remove document from registration form
    registrationForm.documents = registrationForm.documents.filter(
      doc => doc.documentName !== documentName
    );
    
    await registrationForm.save();
    
    // Also remove from Pet model
    const updateData = {
      [`${documentName}.fileData`]: null,
      [`${documentName}.fileName`]: null,
      [`${documentName}.fileSize`]: null,
      [`${documentName}.mimeType`]: null,
      [`${documentName}.uploadedAt`]: null
    };
    await Pet.findByIdAndUpdate(pet._id, updateData);
    
    // Check if all required docs are uploaded
    const requiredDocs = getRequiredDocumentNames(pet);
    const hasAllDocs = hasAllDocuments(pet, registrationForm);
    
    // Update pet status if documents are no longer complete
    if (!hasAllDocs && pet.registrationStatus === 'documents_uploaded') {
      pet.registrationStatus = 'not_started';
      pet.registrationStage = 0;
      await pet.save();
    }
    
    res.json({ 
      success: true,
      message: 'Document deleted successfully',
      registration: {
        uploadedDocumentsCount: registrationForm.documents.length,
        requiredDocumentsCount: requiredDocs.length,
        hasAllDocuments: hasAllDocs,
        registrationTriggered: registrationForm.registrationTriggered || false,
        isComplete: registrationForm.isComplete || false
      }
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
    const hasAllDocs = hasAllDocuments(pet, registrationForm);
    
    if (!hasAllDocs) {
      return res.status(400).json({ 
        success: false,
        message: `All required documents must be uploaded`,
        uploadedCount: registrationForm.documents.length,
        requiredCount: requiredDocs.length,
        requiredDocuments: requiredDocs,
        uploadedDocuments: registrationForm.documents.map(d => d.documentName),
        missingDocuments: requiredDocs.filter(doc => 
          !registrationForm.documents.some(d => d.documentName === doc)
        )
      });
    }
    
    if (!paymentVerified) {
      return res.status(400).json({ 
        success: false,
        message: 'Payment verification required' 
      });
    }
    
    // Calculate amount based on city
    let amount = 999; // default
    if (['ghaziabad', 'noida'].includes(pet.city)) {
      amount = 500;
    } else if (pet.city === 'faridabad') {
      amount = 750;
    }
    
    // Add delivery cost if applicable
    if (tagDeliveryOption === 'deliver_to_home' && tagDeliveryCost) {
      amount += tagDeliveryCost;
    }
    
    // Update registration form
    registrationForm.registrationTriggered = true;
    registrationForm.registrationTriggeredAt = new Date();
    registrationForm.isComplete = true;
    registrationForm.paymentStatus = 'completed';
    registrationForm.paymentAmount = paidAmount || amount;
    
    await registrationForm.save();
    
    // Update pet
    pet.registrationTriggered = true;
    pet.registrationTriggeredAt = new Date();
    pet.registrationStatus = 'form_submitted';
    pet.registrationStage = 2;
    pet.paymentStatus = 'completed';
    pet.paymentAmount = paidAmount || amount;
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
      message: 'Registration submitted successfully! You will receive the license within 7-10 business days.',
      registration: {
        id: registrationForm._id,
        petId: pet._id,
        petName: pet.name,
        city: pet.city,
        registrationStatus: pet.registrationStatus,
        registrationStage: pet.registrationStage,
        registrationTriggered: pet.registrationTriggered,
        registrationTriggeredAt: pet.registrationTriggeredAt,
        paymentStatus: pet.paymentStatus,
        paymentAmount: pet.paymentAmount,
        tagDelivery: pet.tagDelivery,
        documentsUploaded: registrationForm.documents.length,
        documentsRequired: requiredDocs.length
      }
    });
  } catch (error) {
    console.error('Trigger registration error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get document requirements for a city
router.get('/requirements/:city', auth, async (req, res) => {
  try {
    const { city } = req.params;
    
    const tempPet = { city };
    if (city === 'gurgaon') {
      tempPet.ageYears = 5;
      tempPet.ageMonths = 0;
    }
    
    const requiredDocs = getRequiredDocumentNames(tempPet);
    const requiredCount = requiredDocs.length;
    
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
      microchipDetails: 'Microchip Details'
    };
    
    const documents = requiredDocs.map(doc => ({
      key: doc,
      label: displayNames[doc] || doc,
      required: true
    }));
    
    res.json({
      city,
      requiredCount,
      documents,
      isGurgaon: city === 'gurgaon',
      isFaridabad: city === 'faridabad',
      isGhaziabadNoida: ['ghaziabad', 'noida'].includes(city)
    });
  } catch (error) {
    console.error('Requirements error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;