const express = require('express');
const router = express.Router();
const Pet = require('../models/Pet');
const { auth } = require('../middleware/auth');

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
    
    // Build documents array
    const documents = [];
    const docFields = ['antiRabiesCertificate', 'idProof', 'residenceProof', 'ownerWithPetPhoto', 'sterilizationCertificate'];
    
    for (const field of docFields) {
      if (pet[field]?.fileData) {
        documents.push({
          documentName: field,
          fileName: pet[field].fileName,
          fileSize: pet[field].fileSize,
          fileData: pet[field].fileData,
          mimeType: pet[field].mimeType,
          uploadedAt: pet[field].uploadedAt || new Date()
        });
      }
    }
    
    const requiredDocs = ['antiRabiesCertificate', 'idProof', 'residenceProof', 'ownerWithPetPhoto'];
    if (pet.isSterilizationRequired) {
      requiredDocs.push('sterilizationCertificate');
    }
    
    const hasAllDocuments = requiredDocs.every(docName => 
      documents.some(doc => doc.documentName === docName)
    );
    
    const uploadedDocumentsCount = documents.length;
    
    const petObj = pet.toObject();
    petObj.isSterilizationRequired = pet.isSterilizationRequired;
    petObj.isTagDeliveryAvailable = pet.isTagDeliveryAvailable;
    petObj.ageInYears = pet.ageInYears;
    
    res.json({
      pet: petObj,
      documents,
      uploadedDocumentsCount,
      requiredDocumentsCount: requiredDocs.length,
      hasAllDocuments,
      registrationTriggered: pet.registrationTriggered || false,
      registrationTriggeredAt: pet.registrationTriggeredAt || null,
      registrationStatus: pet.registrationStatus || 'not_started',
      tagDelivery: pet.tagDelivery,
      sterilizationCertificate: pet.sterilizationCertificate,
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
    
    const pet = await Pet.findOne({ 
      _id: req.params.petId, 
      owner: req.user._id 
    });
    
    if (!pet) {
      return res.status(404).json({ message: 'Pet not found' });
    }
    
    const docFieldMap = {
      'antiRabiesCertificate': 'antiRabiesCertificate',
      'idProof': 'idProof',
      'residenceProof': 'residenceProof',
      'ownerWithPetPhoto': 'ownerWithPetPhoto',
      'sterilizationCertificate': 'sterilizationCertificate'
    };
    
    const fieldName = docFieldMap[documentName];
    if (!fieldName) {
      return res.status(400).json({ message: 'Invalid document name' });
    }
    
    pet[fieldName] = {
      fileData,
      fileName,
      fileSize,
      mimeType,
      uploadedAt: new Date()
    };
    
    const requiredDocs = ['antiRabiesCertificate', 'idProof', 'residenceProof', 'ownerWithPetPhoto'];
    if (pet.isSterilizationRequired) {
      requiredDocs.push('sterilizationCertificate');
    }
    
    const allUploaded = requiredDocs.every(docName => pet[docName]?.fileData);
    pet.hasAllDocuments = allUploaded;
    pet.uploadedDocumentsCount = requiredDocs.filter(docName => pet[docName]?.fileData).length;
    
    await pet.save();
    
    res.json({
      message: 'Document uploaded successfully',
      uploadedDocumentsCount: pet.uploadedDocumentsCount,
      hasAllDocuments: pet.hasAllDocuments,
      registrationTriggered: pet.registrationTriggered
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
    
    const pet = await Pet.findOne({ 
      _id: petId, 
      owner: req.user._id 
    });
    
    if (!pet) {
      return res.status(404).json({ message: 'Pet not found' });
    }
    
    const docFieldMap = {
      'antiRabiesCertificate': 'antiRabiesCertificate',
      'idProof': 'idProof',
      'residenceProof': 'residenceProof',
      'ownerWithPetPhoto': 'ownerWithPetPhoto',
      'sterilizationCertificate': 'sterilizationCertificate'
    };
    
    const fieldName = docFieldMap[documentName];
    if (!fieldName) {
      return res.status(400).json({ message: 'Invalid document name' });
    }
    
    pet[fieldName] = undefined;
    
    const requiredDocs = ['antiRabiesCertificate', 'idProof', 'residenceProof', 'ownerWithPetPhoto'];
    if (pet.isSterilizationRequired) {
      requiredDocs.push('sterilizationCertificate');
    }
    
    const uploadedCount = requiredDocs.filter(docName => pet[docName]?.fileData).length;
    pet.uploadedDocumentsCount = uploadedCount;
    pet.hasAllDocuments = uploadedCount === requiredDocs.length;
    
    await pet.save();
    
    res.json({ message: 'Document deleted successfully' });
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
    
    const requiredDocs = ['antiRabiesCertificate', 'idProof', 'residenceProof', 'ownerWithPetPhoto'];
    if (pet.isSterilizationRequired) {
      requiredDocs.push('sterilizationCertificate');
    }
    
    const allUploaded = requiredDocs.every(docName => pet[docName]?.fileData);
    if (!allUploaded) {
      return res.status(400).json({ message: 'All required documents must be uploaded' });
    }
    
    if (!paymentVerified) {
      return res.status(400).json({ message: 'Payment verification required' });
    }
    
    pet.registrationTriggered = true;
    pet.registrationTriggeredAt = new Date();
    pet.registrationStatus = 'form_submitted';
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
        tagDelivery: pet.tagDelivery,
        sterilizationCertificate: pet.sterilizationCertificate,
      }
    });
  } catch (error) {
    console.error('Trigger registration error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;