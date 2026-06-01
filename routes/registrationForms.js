const express = require('express');
const router = express.Router();
const RegistrationForm = require('../models/RegsitrationForm');
const Pet = require('../models/Pet');
const { auth } = require('../middleware/auth');

// GET registration status for a specific pet
router.get('/:petId/status', auth, async (req, res) => {
  try {
    const pet = await Pet.findOne({ 
      _id: req.params.petId, 
      owner: req.user._id 
    });
    
    if (!pet) {
      return res.status(403).json({ message: 'Pet not found or access denied' });
    }

    let form = await RegistrationForm.findOne({ pet: req.params.petId });
    
    if (!form) {
      return res.json({
        petId: req.params.petId,
        petName: pet.name,
        uploadedDocumentsCount: 0,
        totalRequiredDocuments: 4,
        hasAllDocuments: false,
        missingDocuments: ['antiRabiesCertificate', 'idProof', 'residenceProof', 'ownerWithPetPhoto'],
        registrationTriggered: false,
        isComplete: false,
        documents: [],
        petRegistrationStatus: pet.registrationStatus,   // ← ADD
        message: 'No registration found. Please upload documents to start.'
      });
    }

    res.json({
      petId: req.params.petId,
      petName: pet.name,
      uploadedDocumentsCount: form.uploadedDocumentsCount,
      totalRequiredDocuments: 4,
      hasAllDocuments: form.hasAllDocuments,
      missingDocuments: form.missingDocuments,
      registrationTriggered: form.registrationTriggered,
      registrationTriggeredAt: form.registrationTriggeredAt,
      isComplete: form.isComplete,
      documents: form.documents,
      paymentStatus: form.paymentStatus || 'pending',
      petRegistrationStatus: pet.registrationStatus,     // ← ADD
      createdAt: form.createdAt,
      updatedAt: form.updatedAt
    });
  } catch (error) {
    console.error("GET registration status error:", error);
    res.status(500).json({ message: error.message });
  }
});

// UPLOAD a single document (Base64) - NO AUTO-TRIGGER
router.post('/:petId/documents', auth, async (req, res) => {
  try {
    const pet = await Pet.findOne({ 
      _id: req.params.petId, 
      owner: req.user._id 
    });
    
    if (!pet) {
      return res.status(403).json({ message: 'Pet not found or access denied' });
    }

    const { documentName, fileData, fileName, fileSize, mimeType } = req.body;
    const validDocuments = ['antiRabiesCertificate', 'idProof', 'residenceProof', 'ownerWithPetPhoto'];
    
    if (!validDocuments.includes(documentName)) {
      return res.status(400).json({ message: 'Invalid document name' });
    }

    if (!fileData) {
      return res.status(400).json({ message: 'No file data provided' });
    }

    let form = await RegistrationForm.findOne({ pet: req.params.petId });
    if (!form) {
      form = new RegistrationForm({ pet: req.params.petId, documents: [] });
    }

    const existingDocIndex = form.documents.findIndex(doc => doc.documentName === documentName);
    
    const newDocument = {
      documentName,
      fileData,
      fileName,
      fileSize,
      mimeType,
      uploadedAt: new Date()
    };

    if (existingDocIndex !== -1) {
      form.documents[existingDocIndex] = newDocument;
    } else {
      form.documents.push(newDocument);
    }

    await form.save();

    // ─── CACHE WRITE: mirror doc count onto Pet so dashboard needs 0 extra calls ───
    // Always keep uploadedDocumentsCount in sync on the Pet document itself.
    // This means GET /pets returns everything the dashboard needs — no status calls.
    const petUpdate = {
      uploadedDocumentsCount: form.documents.length,   // ← CACHE: always sync
      hasAllDocuments: form.hasAllDocuments,            // ← CACHE: always sync
    };

    if (form.hasAllDocuments && !form.registrationTriggered) {
      petUpdate.registrationStage = 1;
      petUpdate.registrationStatus = 'documents_uploaded';
    }

    await Pet.findByIdAndUpdate(pet._id, petUpdate);
    // ─────────────────────────────────────────────────────────────────────────────

    res.json({
      message: 'Document uploaded successfully',
      document: newDocument,
      uploadedDocumentsCount: form.uploadedDocumentsCount,
      hasAllDocuments: form.hasAllDocuments,
      registrationTriggered: form.registrationTriggered,
      missingDocuments: form.missingDocuments
    });
  } catch (error) {
    console.error("Upload document error:", error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE a specific document
router.delete('/:petId/documents/:documentName', auth, async (req, res) => {
  try {
    const pet = await Pet.findOne({ 
      _id: req.params.petId, 
      owner: req.user._id 
    });
    
    if (!pet) {
      return res.status(403).json({ message: 'Pet not found or access denied' });
    }

    const form = await RegistrationForm.findOne({ pet: req.params.petId });
    if (!form) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    const documentName = req.params.documentName;
    const documentIndex = form.documents.findIndex(doc => doc.documentName === documentName);
    
    if (documentIndex === -1) {
      return res.status(404).json({ message: 'Document not found' });
    }

    form.documents.splice(documentIndex, 1);
    
    if (form.registrationTriggered && form.documents.length < 4) {
      form.registrationTriggered = false;
      form.registrationTriggeredAt = null;
      form.isComplete = false;
    }
    
    await form.save();

    // ─── CACHE WRITE: sync count back down on delete too ───
    await Pet.findByIdAndUpdate(pet._id, {
      uploadedDocumentsCount: form.documents.length,
      hasAllDocuments: form.hasAllDocuments,
      ...(form.documents.length < 4 && {
        registrationStage: 0,
        registrationStatus: 'not_started',
      }),
    });
    // ───────────────────────────────────────────────────────

    res.json({
      message: 'Document deleted successfully',
      uploadedDocumentsCount: form.uploadedDocumentsCount,
      hasAllDocuments: form.hasAllDocuments,
      registrationTriggered: form.registrationTriggered,
      missingDocuments: form.missingDocuments
    });
  } catch (error) {
    console.error("Delete document error:", error);
    res.status(500).json({ message: error.message });
  }
});

// TRIGGER registration process manually - REQUIRES PAYMENT VERIFICATION
router.post('/:petId/trigger-registration', auth, async (req, res) => {
  try {
    const { paymentVerified } = req.body;
    
    const pet = await Pet.findOne({ 
      _id: req.params.petId, 
      owner: req.user._id 
    });
    
    if (!pet) {
      return res.status(403).json({ message: 'Pet not found or access denied' });
    }

    const form = await RegistrationForm.findOne({ pet: req.params.petId });
    if (!form) {
      return res.status(404).json({ message: 'No registration found. Please upload documents first.' });
    }

    if (form.documents.length !== 4) {
      return res.status(400).json({ 
        message: `Cannot trigger registration. Please upload all 4 documents. Currently uploaded: ${form.documents.length}/4`,
        missingDocuments: form.missingDocuments
      });
    }

    if (form.registrationTriggered) {
      return res.status(400).json({ message: 'Registration already triggered for this pet' });
    }

    if (!paymentVerified) {
      return res.status(402).json({ message: 'Payment required to complete registration. Please pay ₹999 first.' });
    }

    const triggered = await form.triggerRegistration(true);
    
    if (triggered) {
      await Pet.findByIdAndUpdate(pet._id, {
        registrationStage: 2,
        registrationStatus: 'form_submitted',
        registrationTriggered: true,   // ← CACHE: so /pets shows correct state
      });
      
      res.json({
        message: 'Registration process triggered successfully!',
        registrationTriggered: true,
        registrationTriggeredAt: form.registrationTriggeredAt,
        isComplete: true
      });
    } else {
      res.status(400).json({ message: 'Failed to trigger registration' });
    }
  } catch (error) {
    console.error("Trigger registration error:", error);
    res.status(500).json({ message: error.message });
  }
});

// GET all pets with registration status — used by dashboard for single-call load
router.get('/user/all-status', auth, async (req, res) => {
  try {
    const pets = await Pet.find({ owner: req.user._id });
    
    const petsStatus = await Promise.all(pets.map(async (pet) => {
      const form = await RegistrationForm.findOne({ pet: pet._id });
      
      return {
        petId: pet._id,
        petName: pet.name,
        profilePicture: pet.profilePicture || null,
        uploadedDocumentsCount: form ? form.uploadedDocumentsCount : 0,
        totalRequiredDocuments: 4,
        hasAllDocuments: form ? form.hasAllDocuments : false,
        registrationTriggered: form ? form.registrationTriggered : false,
        registrationStage: pet.registrationStage || 0,
        registrationStatus: pet.registrationStatus || 'not_started',
        hasRegistration: !!form
      };
    }));
    
    res.json(petsStatus);
  } catch (error) {
    console.error("Get all pets status error:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;