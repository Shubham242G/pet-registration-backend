const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const router = express.Router();

// ─── WEBSITE: WhatsApp Registration (UNCHANGED) ──────────────────────────
router.post('/register', async (req, res) => {
  try {
    console.log('Register attempt - Body:', req.body);
    const { email, password, username, name, city } = req.body;
    
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
    
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    
    const existingUsername = await User.findOne({ username: userName });
    if (existingUsername) {
      return res.status(400).json({ message: 'Username already taken' });
    }
    
    const pricingTier = city === 'ghaziabad' ? 'ghaziabad' : 'standard';
    const registrationFee = city === 'ghaziabad' ? 1499 : 999;
    
    // WhatsApp number is optional for email signup
    const user = new User({ 
      whatsappNumber: null, // Will be linked later via WhatsApp
      email, 
      password,
      username: userName,
      name: userName,
      city: city,
      pricingTier: pricingTier,
      registrationFee: registrationFee,
      role: 'user',
      isVerified: true
    });
    await user.save();
    
    console.log('User created successfully:', user._id);
    
    const token = jwt.sign(
      { userId: user._id, role: user.role }, 
      process.env.JWT_SECRET || 'your-secret-key', 
      { expiresIn: '7d' }
    );
    
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        email: user.email, 
        username: user.username,
        name: user.name,
        role: user.role,
        city: user.city,
        pricingTier: user.pricingTier,
        registrationFee: user.registrationFee,
        whatsappNumber: user.whatsappNumber
      } 
    });
  } catch (error) {
    console.error('Register error details:', error);
    res.status(500).json({ message: error.message });
  }
});

// ─── WEBSITE: WhatsApp Login (UNCHANGED) ──────────────────────────────────
router.post('/whatsapp-login', async (req, res) => {
  try {
    const { whatsappNumber } = req.body;
    
    if (!whatsappNumber) {
      return res.status(400).json({ message: 'WhatsApp number is required' });
    }
    
    let user = await User.findOne({ whatsappNumber });
    
    if (!user) {
      // Create new user with WhatsApp number
      user = new User({
        whatsappNumber,
        name: `Pet Parent ${whatsappNumber.slice(-4)}`,
        role: 'user',
        isVerified: true,
        city: 'other',
        pricingTier: 'standard',
        registrationFee: 999
      });
      await user.save();
    }
    
    const token = jwt.sign(
      { userId: user._id, role: user.role }, 
      process.env.JWT_SECRET || 'your-secret-key', 
      { expiresIn: '7d' }
    );
    
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        email: user.email, 
        username: user.username,
        name: user.name,
        role: user.role,
        city: user.city,
        pricingTier: user.pricingTier,
        registrationFee: user.registrationFee,
        whatsappNumber: user.whatsappNumber
      } 
    });
  } catch (error) {
    console.error('WhatsApp login error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ─── ADMIN: Email Login (FIXED) ──────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    console.log('Admin login attempt:', req.body.email);
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    // Find user by email or username
    const user = await User.findOne({ 
      $or: [
        { email: email }, 
        { username: email }
      ] 
    });
    
    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    console.log('User found:', user.email || user.username);
    console.log('User role:', user.role);
    
    // Check if user has a password
    if (!user.password) {
      return res.status(401).json({ 
        message: 'This account uses WhatsApp login. Please use WhatsApp to sign in.' 
      });
    }
    
    // Compare password using the schema method
    const isMatch = await user.comparePassword(password);
    console.log('Password match:', isMatch);
    
    if (!isMatch) {
      console.log('Password mismatch for:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Update last login
    user.lastLoginAt = new Date();
    await user.save();
    
    const token = jwt.sign(
      { userId: user._id, role: user.role }, 
      process.env.JWT_SECRET || 'your-secret-key', 
      { expiresIn: '7d' }
    );
    
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
        registrationFee: user.registrationFee || (user.city === 'ghaziabad' ? 1499 : 999)
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── WEBSITE: WhatsApp OTP (UNCHANGED) ────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  try {
    const { whatsappNumber } = req.body;
    
    if (!whatsappNumber) {
      return res.status(400).json({ message: 'WhatsApp number is required' });
    }
    
    // Generate OTP logic here...
    // This is a placeholder - implement your OTP service
    
    res.json({ 
      success: true, 
      message: 'OTP sent successfully',
      // For testing only - remove in production
      otp: '123456' 
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ─── WEBSITE: Verify OTP (UNCHANGED) ──────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { whatsappNumber, otp } = req.body;
    
    if (!whatsappNumber || !otp) {
      return res.status(400).json({ message: 'WhatsApp number and OTP are required' });
    }
    
    // Verify OTP logic here...
    // For testing, accept '123456' as valid
    if (otp !== '123456') {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
    
    // Find or create user
    let user = await User.findOne({ whatsappNumber });
    
    if (!user) {
      user = new User({
        whatsappNumber,
        name: `Pet Parent ${whatsappNumber.slice(-4)}`,
        role: 'user',
        isVerified: true,
        city: 'other',
        pricingTier: 'standard',
        registrationFee: 999
      });
      await user.save();
    }
    
    const token = jwt.sign(
      { userId: user._id, role: user.role }, 
      process.env.JWT_SECRET || 'your-secret-key', 
      { expiresIn: '7d' }
    );
    
    // Check if user has email (complete registration)
    const requiresRegistration = !user.email;
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        city: user.city,
        pricingTier: user.pricingTier,
        registrationFee: user.registrationFee,
        whatsappNumber: user.whatsappNumber
      },
      requiresRegistration
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ─── ADMIN: Verify token (UNCHANGED) ──────────────────────────────────────
router.get('/verify', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ valid: false, message: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ valid: false, message: 'User not found' });
    }
    
    if (user.isDeleted) {
      return res.status(401).json({ valid: false, message: 'User account has been deleted' });
    }
    
    res.json({ 
      valid: true, 
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        name: user.name || user.username,
        role: user.role,
        whatsappNumber: user.whatsappNumber,
        city: user.city || 'other',
        pricingTier: user.pricingTier || 'standard',
        registrationFee: user.registrationFee || (user.city === 'ghaziabad' ? 1499 : 999)
      } 
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(401).json({ valid: false, message: 'Token invalid or expired' });
  }
});

// ─── WEBSITE: Link WhatsApp (UNCHANGED) ──────────────────────────────────
router.post('/link-whatsapp', async (req, res) => {
  try {
    const { whatsappNumber } = req.body;
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    if (!whatsappNumber) {
      return res.status(400).json({ message: 'WhatsApp number is required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    const existingUser = await User.findOne({ 
      whatsappNumber: whatsappNumber,
      _id: { $ne: decoded.userId } 
    });
    if (existingUser) {
      return res.status(400).json({ message: 'WhatsApp number already registered by another user' });
    }
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.whatsappNumber = whatsappNumber;
    await user.save();
    
    res.json({ 
      success: true, 
      message: 'WhatsApp number linked successfully',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        name: user.name,
        whatsappNumber: user.whatsappNumber
      }
    });
  } catch (error) {
    console.error('Link WhatsApp error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ─── USER: Update profile (UNCHANGED) ──────────────────────────────────────
router.put('/profile', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const { name, email, city } = req.body;
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (name) user.name = name;
    if (email) user.email = email;
    if (city) {
      user.city = city;
      user.pricingTier = city === 'ghaziabad' ? 'ghaziabad' : 'standard';
      user.registrationFee = city === 'ghaziabad' ? 1499 : 999;
    }
    
    await user.save();
    
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        name: user.name,
        city: user.city,
        pricingTier: user.pricingTier,
        registrationFee: user.registrationFee,
        whatsappNumber: user.whatsappNumber
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;