const express = require('express');
const router = express.Router();
const RegistrationForm = require('../models/RegsitrationForm');
const Pet = require('../models/Pet');
const { auth } = require('../middleware/auth');

// GET registration form for a specific pet
router.get('/:petId', auth, async (req, res) => {
  try {
    // Check pet ownership
    const pet = await Pet.findOne({ 
      _id: req.params.petId, 
      owner: req.user._id 
    });
    
    if (!pet) {
      return res.status(403).json({ message: 'Pet not found or access denied' });
    }

    const form = await RegistrationForm.findOne({ pet: req.params.petId });
    res.json(form);
  } catch (error) {
    console.error("GET registration error:", error);
    res.status(500).json({ message: error.message });
  }
});

// CREATE new registration form
router.post('/:petId', auth, async (req, res) => {
  try {
    // Check pet ownership
    const pet = await Pet.findOne({ 
      _id: req.params.petId, 
      owner: req.user._id 
    });
    
    if (!pet) {
      return res.status(403).json({ message: 'Pet not found or access denied' });
    }

    // Check if registration already exists
    const existingForm = await RegistrationForm.findOne({ pet: req.params.petId });
    if (existingForm) {
      return res.status(400).json({ message: 'Registration already exists. Use PUT to update.' });
    }

    // Get data from frontend
    const { applicantDetails, address, dogDetails, documents } = req.body;

    // Create new registration
    const form = new RegistrationForm({
      pet: req.params.petId,
      applicantDetails: {
        firstName: applicantDetails?.firstName || "",
        middleName: applicantDetails?.middleName || "",
        lastName: applicantDetails?.lastName || "",
        dob: applicantDetails?.dob || ""
      },
      address: {
        plot: address?.plot || "",
        street: address?.street || "",
        pin: address?.pin || "",
        colony: address?.colony || "",
        ward: address?.ward || "",
        zone: address?.zone || "",
        mobile: address?.mobile || "",
        email: address?.email || ""
      },
      dogDetails: {
        gender: dogDetails?.gender || "",
        photo: dogDetails?.photo || "",
        breed: dogDetails?.breed || "",
        ageYears: dogDetails?.ageYears || "",
        ageMonths: dogDetails?.ageMonths || "",
        antiRabiesDate: dogDetails?.antiRabiesDate || "",
        vaccinationValidTill: dogDetails?.vaccinationValidTill || "",
        certificateNumber: dogDetails?.certificateNumber || "",
        certificateDate: dogDetails?.certificateDate || "",
        vetName: dogDetails?.vetName || "",
        councilName: dogDetails?.councilName || "",
        vetRegistrationNumber: dogDetails?.vetRegistrationNumber || "",
        vetMobile: dogDetails?.vetMobile || ""
      },
      documents: {
        antiRabiesCertificate: documents?.antiRabiesCertificate || "",
        idProof: documents?.idProof || "",
        residenceProof: documents?.residenceProof || "",
        ownerWithPetPhoto: documents?.ownerWithPetPhoto || ""
      },
      isFilled: true
    });

    await form.save();
    console.log("Registration created successfully:", form._id);
    res.status(201).json(form);
  } catch (error) {
    console.error("POST registration error:", error);
    res.status(500).json({ message: error.message });
  }
});

// UPDATE existing registration form
router.put('/:petId', auth, async (req, res) => {
  try {
    // Check pet ownership
    const pet = await Pet.findOne({ 
      _id: req.params.petId, 
      owner: req.user._id 
    });
    
    if (!pet) {
      return res.status(403).json({ message: 'Pet not found or access denied' });
    }

    // Get data from frontend
    const { applicantDetails, address, dogDetails, documents } = req.body;

    // Update registration
    const form = await RegistrationForm.findOneAndUpdate(
      { pet: req.params.petId },
      {
        applicantDetails: {
          firstName: applicantDetails?.firstName || "",
          middleName: applicantDetails?.middleName || "",
          lastName: applicantDetails?.lastName || "",
          dob: applicantDetails?.dob || ""
        },
        address: {
          plot: address?.plot || "",
          street: address?.street || "",
          pin: address?.pin || "",
          colony: address?.colony || "",
          ward: address?.ward || "",
          zone: address?.zone || "",
          mobile: address?.mobile || "",
          email: address?.email || ""
        },
        dogDetails: {
          gender: dogDetails?.gender || "",
          photo: dogDetails?.photo || "",
          breed: dogDetails?.breed || "",
          ageYears: dogDetails?.ageYears || "",
          ageMonths: dogDetails?.ageMonths || "",
          antiRabiesDate: dogDetails?.antiRabiesDate || "",
          vaccinationValidTill: dogDetails?.vaccinationValidTill || "",
          certificateNumber: dogDetails?.certificateNumber || "",
          certificateDate: dogDetails?.certificateDate || "",
          vetName: dogDetails?.vetName || "",
          councilName: dogDetails?.councilName || "",
          vetRegistrationNumber: dogDetails?.vetRegistrationNumber || "",
          vetMobile: dogDetails?.vetMobile || ""
        },
        documents: {
          antiRabiesCertificate: documents?.antiRabiesCertificate || "",
          idProof: documents?.idProof || "",
          residenceProof: documents?.residenceProof || "",
          ownerWithPetPhoto: documents?.ownerWithPetPhoto || ""
        },
        isFilled: true
      },
      { new: true, upsert: false }
    );

    if (!form) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    console.log("Registration updated successfully:", form._id);
    res.json(form);
  } catch (error) {
    console.error("PUT registration error:", error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE registration form
router.delete('/:petId', auth, async (req, res) => {
  try {
    // Check pet ownership
    const pet = await Pet.findOne({ 
      _id: req.params.petId, 
      owner: req.user._id 
    });
    
    if (!pet) {
      return res.status(403).json({ message: 'Pet not found or access denied' });
    }

    const form = await RegistrationForm.findOneAndDelete({ pet: req.params.petId });
    
    if (!form) {
      return res.status(404).json({ message: 'Registration not found' });
    }
    
    console.log("Registration deleted successfully:", form._id);
    res.json({ message: 'Registration deleted successfully' });
  } catch (error) {
    console.error("DELETE registration error:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;