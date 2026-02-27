const express = require('express');
const jwt = require('jsonwebtoken');
const Pet = require('../models/Pet');
const router = express.Router();

// Middleware to verify JWT
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Get user's pets
router.get('/', auth, async (req, res) => {
  try {
    const pets = await Pet.find({ owner: req.user.userId });
    res.json(pets);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create pet
router.post('/', auth, async (req, res) => {
  try {
    const pet = new Pet({ ...req.body, owner: req.user.userId });
    await pet.save();
    res.status(201).json(pet);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
