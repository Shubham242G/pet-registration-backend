const express = require('express');
const router = express.Router();
const RegistrationForm = require('../models/RegsitrationForm');
const Pet = require('../models/Pet');
const { auth } = require('../middleware/auth');

// GET customer's registration forms (with pets)
router.get('/', auth, async (req, res) => {
  try {
    const pets = await Pet.find({ owner: req.user._id });
    const forms = await RegistrationForm.find({ 
      pet: { $in: pets.map(p => p._id) } 
    }).populate('pet');
    res.json(forms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// CREATE/UPDATE registration form
router.post('/:petId', auth, async (req, res) => {
  try {
    const { name, city, animal, breed, documents } = req.body;
    
    // Check pet ownership
    const pet = await Pet.findOne({ 
      _id: req.params.petId, 
      owner: req.user._id 
    });
    if (!pet) {
      return res.status(403).json({ message: 'Pet not found or access denied' });
    }

    // Upsert (create or update)
    const form = await RegistrationForm.findOneAndUpdate(
      { pet: req.params.petId },
      { 
        pet: req.params.petId,
        name, city, animal, breed, 
        documents: documents || [],
        isFilled: true 
      },
      { upsert: true, new: true }
    ).populate('pet');

    res.json(form);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
