const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { sendOTPviaWhatsApp } = require('../servcies/whatsappService');
const router = express.Router();

// Helper to format phone number
const formatPhoneNumber = (number) => {
  const cleaned = number.toString().replace(/\D/g, '');
  if (cleaned.length === 10) return cleaned;
  if (cleaned.length === 12 && cleaned.startsWith('91')) return cleaned.substring(2);
  return cleaned;
};

// STEP 1: Send OTP for login/registration
router.post('/send-otp', async (req, res) => {
  try {
    const { whatsappNumber } = req.body;
    
    if (!whatsappNumber) {
      return res.status(400).json({ error: 'WhatsApp number is required' });
    }
    
    const cleanedNumber = formatPhoneNumber(whatsappNumber);
    
    if (cleanedNumber.length !== 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number' });
    }
    
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    await OTP.deleteMany({ whatsappNumber: cleanedNumber });
    
    await OTP.create({
      whatsappNumber: cleanedNumber,
      otpCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });
    
    const result = await sendOTPviaWhatsApp(cleanedNumber, otpCode);
    
    if (result.success && result.data && !result.data.error) {
      return res.json({ 
        success: true, 
        message: 'OTP sent to your WhatsApp' 
      });
    } else {
      console.error('WhatsApp send failed:', result.error);
      return res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
    }
    
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// STEP 2: Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { whatsappNumber, otpCode } = req.body;
    
    const cleanedNumber = formatPhoneNumber(whatsappNumber);
    
    const otpRecord = await OTP.findOne({
      whatsappNumber: cleanedNumber,
      otpCode,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });
    
    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }
    
    let user = await User.findOne({ whatsappNumber: cleanedNumber });
    
    if (user) {
      otpRecord.isUsed = true;
      await otpRecord.save();
      
      user.lastLoginAt = new Date();
      await user.save();
      
      const token = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      // ✅ CORRECT pricing calculation
      let userRegistrationFee = 942.82;
      if (user.city === 'ghaziabad') {
        userRegistrationFee = 1532.82;
      }
      
      return res.json({
        success: true,
        requiresRegistration: false,
        token,
        user: {
          id: user._id,
          whatsappNumber: user.whatsappNumber,
          email: user.email,
          username: user.username || user.name,
          name: user.name,
          role: user.role,
          city: user.city || 'other',
          pricingTier: user.pricingTier || 'standard',
          registrationFee: userRegistrationFee
        }
      });
    }
    
    otpRecord.isUsed = true;
    await otpRecord.save();
    
    const tempToken = jwt.sign(
      { whatsappNumber: cleanedNumber, temp: true },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    );
    
    res.json({
      success: true,
      requiresRegistration: true,
      tempToken,
      whatsappNumber: cleanedNumber,
      message: 'WhatsApp number verified! Please complete your registration.'
    });
    
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// STEP 3: Complete registration
router.post('/complete-registration', async (req, res) => {
  try {
    const { tempToken, name, username, city, registrationFee } = req.body;
    
    if (!tempToken || !name) {
      return res.status(400).json({ error: 'Name and valid session are required' });
    }
    
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Session expired. Please start over.' });
    }
    
    if (!decoded.temp) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    const { whatsappNumber } = decoded;
    
    let user = await User.findOne({ whatsappNumber });
    if (user) {
      return res.status(400).json({ error: 'User already exists. Please login.' });
    }
    
    if (username) {
      const usernameExists = await User.findOne({ username });
      if (usernameExists) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }
    
    // Determine pricing tier based on city
    const selectedCity = city || 'other';
    const pricingTier = selectedCity === 'ghaziabad' ? 'ghaziabad' : 'standard';
    
    // ✅ CORRECT pricing calculation
    let finalRegistrationFee = registrationFee;
    if (!finalRegistrationFee) {
      if (selectedCity === 'ghaziabad') {
        finalRegistrationFee = 1532.82;
      } else {
        finalRegistrationFee = 942.82;
      }
    }
    
    user = new User({
      whatsappNumber,
      name: name,
      username: username || name.toLowerCase().replace(/\s/g, '') + Math.floor(Math.random() * 1000),
      isVerified: true,
      lastLoginAt: new Date(),
      city: selectedCity,
      pricingTier: pricingTier,
      registrationFee: finalRegistrationFee
    });
    
    await user.save();
    
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        whatsappNumber: user.whatsappNumber,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        city: user.city,
        pricingTier: user.pricingTier,
        registrationFee: finalRegistrationFee
      }
    });
    
  } catch (error) {
    console.error('Complete registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { whatsappNumber } = req.body;
    const cleanedNumber = formatPhoneNumber(whatsappNumber);
    
    if (cleanedNumber.length !== 10) {
      return res.status(400).json({ error: 'Valid 10-digit number required' });
    }
    
    await OTP.deleteMany({ whatsappNumber: cleanedNumber });
    
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    await OTP.create({
      whatsappNumber: cleanedNumber,
      otpCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });
    
    const result = await sendOTPviaWhatsApp(cleanedNumber, otpCode);
    
    if (!result.success) {
      return res.status(500).json({ error: 'Failed to send OTP' });
    }
    
    res.json({ success: true, message: 'OTP resent successfully' });
    
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: 'Failed to resend OTP' });
  }
});

module.exports = router;