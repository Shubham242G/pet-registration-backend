const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Register with WhatsApp (updated to include city)
router.post('/register', async (req, res) => {
  try {
    console.log('Register attempt - Body:', req.body);
    const { email, password, username, name, city } = req.body;
    
    // Use username from frontend, fallback to name
    const userName = username || name;
    
    if (!userName) {
      return res.status(400).json({ message: 'Username is required' });
    }
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }
    if (!city) {
      return res.status(400).json({ message: 'Please select your city' });
    }
    
    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    
    // Check if username already exists
    const existingUsername = await User.findOne({ username: userName });
    if (existingUsername) {
      return res.status(400).json({ message: 'Username already taken' });
    }
    
    // Determine pricing tier based on city
    const pricingTier = city === 'ghaziabad' ? 'ghaziabad' : 'standard';
    
    // Create user with city
    const user = new User({ 
      email, 
      password, 
      username: userName,
      name: userName,
      whatsappNumber: null,
      city: city,
      pricingTier: pricingTier
    });
    await user.save();
    
    console.log('User created successfully:', user._id);
    
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        email, 
        username: userName,
        name: userName,
        role: user.role,
        city: user.city,
        pricingTier: user.pricingTier,
        registrationFee: user.registrationFee
      } 
    });
  } catch (error) {
    console.error('Register error details:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/verify', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ valid: false, message: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ valid: false, message: 'User not found' });
    }
    
    res.json({ 
      valid: true, 
      user: {
        id: user._id,
        email: user.email,
        username: user.username || user.name,
        name: user.name || user.username,
        role: user.role,
        whatsappNumber: user.whatsappNumber,
        city: user.city || 'other',
        pricingTier: user.pricingTier || 'standard',
        registrationFee: user.city === 'ghaziabad' ? 1499 : 999
      } 
    });
  } catch (error) {
    res.status(401).json({ valid: false, message: 'Token invalid or expired' });
  }
});

router.post('/login', async (req, res) => {
  try {
    console.log('Login attempt:', req.body.email);
    const { email, password } = req.body;
    
    // Allow login with email, username, OR whatsappNumber
    const user = await User.findOne({ 
      $or: [
        { email: email }, 
        { username: email },
        { whatsappNumber: email }
      ] 
    });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // If user doesn't have a password (WhatsApp-only user), don't allow email login
    if (!user.password) {
      return res.status(401).json({ message: 'This account uses WhatsApp login. Please use WhatsApp to sign in.' });
    }
    
    if (!(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        email: user.email, 
        username: user.username,
        name: user.name || user.username,
        role: user.role,
        whatsappNumber: user.whatsappNumber,
        city: user.city || 'other',
        pricingTier: user.pricingTier || 'standard',
        registrationFee: user.city === 'ghaziabad' ? 1499 : 999
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Add a route to link WhatsApp number to existing email account
router.post('/link-whatsapp', async (req, res) => {
  try {
    const { userId, whatsappNumber } = req.body;
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if WhatsApp number is already used
    const existingUser = await User.findOne({ whatsappNumber });
    if (existingUser && existingUser._id.toString() !== decoded.userId) {
      return res.status(400).json({ message: 'WhatsApp number already registered' });
    }
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.whatsappNumber = whatsappNumber;
    await user.save();
    
    res.json({ success: true, message: 'WhatsApp number linked successfully' });
  } catch (error) {
    console.error('Link WhatsApp error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;