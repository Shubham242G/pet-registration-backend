const express = require('express');
const Pet = require('../models/Pet');
const RegistrationForm = require('../models/RegsitrationForm');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Get all pets
router.get('/', auth, async (req, res) => {
  try {
    const pets = await Pet.find({ owner: req.user._id });
    res.json(pets);
  } catch (error) {
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
      registrationStatus: 'not_started'
    };
    
    const pet = new Pet(petData);
    await pet.save();
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

// Delete pet (also deletes registration)
router.delete('/:id', auth, async (req, res) => {
  try {
    const pet = await Pet.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!pet) return res.status(404).json({ message: 'Pet not found' });
    
    // Delete associated registration
    await RegistrationForm.findOneAndDelete({ pet: req.params.id });
    
    res.json({ message: 'Pet deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;