const express = require('express');
const Pet = require('../models/Pet');
const RegistrationForm = require('../models/RegsitrationForm'); // ✅ Add this
const { auth } = require('../middleware/auth');
const router = express.Router();

router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

// Get all pets - EXCLUDE fileData from ALL document fields
router.get('/', auth, async (req, res) => {
  try {
    const pets = await Pet.find({ owner: req.user._id })
      .select(
        '-antiRabiesCertificate.fileData -idProof.fileData ' +
        '-residenceProof.fileData -ownerWithPetPhoto.fileData ' +
        '-petPhoto.fileData -vaccinationCard.fileData ' +
        '-vaccinationCertificate.fileData -sterilizationCertificate.fileData'
      );
    res.json(pets);
  } catch (error) {
    console.error('Get pets error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single pet
router.get('/:id', auth, async (req, res) => {
  try {
    const pet = await Pet.findOne({ _id: req.params.id, owner: req.user._id });
    if (!pet) return res.status(404).json({ message: 'Pet not found' });
    res.json(pet);
  } catch (error) {
    console.error('Get pet error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create pet
router.post('/', auth, async (req, res) => {
  try {
    const petData = {
      ...req.body,
      owner: req.user._id,
      registrationStage: 0,
      registrationStatus: 'not_started',
    };
    const pet = new Pet(petData);
    await pet.save();
    
    // ✅ Create registration form for the pet
    const registrationForm = new RegistrationForm({
      pet: pet._id,
      documents: [],
      registrationTriggered: false,
      isComplete: false,
      paymentStatus: 'pending'
    });
    await registrationForm.save();
    
    res.status(201).json(pet);
  } catch (error) {
    console.error('Create pet error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update pet
router.put('/:id', auth, async (req, res) => {
  try {
    const pet = await Pet.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!pet) return res.status(404).json({ message: 'Pet not found' });
    res.json(pet);
  } catch (error) {
    console.error('Update pet error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete pet
router.delete('/:id', auth, async (req, res) => {
  try {
    const pet = await Pet.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!pet) return res.status(404).json({ message: 'Pet not found' });
    
    // ✅ Delete registration form as well
    await RegistrationForm.findOneAndDelete({ pet: pet._id });
    
    res.json({ message: 'Pet deleted successfully' });
  } catch (error) {
    console.error('Delete pet error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;