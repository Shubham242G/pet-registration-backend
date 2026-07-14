// routes/whatsapp.js
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');

// Send WhatsApp message
router.post('/send-message', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone number and message are required' 
      });
    }
    
    // Format phone number (remove + if present)
    let formattedNumber = phoneNumber.replace('+', '');
    
    // Use your existing WhatsApp API
    const whatsappApiUrl = process.env.WHATSAPP_API_URL || 'http://localhost:5000/api/whatsapp/send';
    
    const response = await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: formattedNumber,
        message: message,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'WhatsApp API error');
    }
    
    res.json({
      success: true,
      message: 'WhatsApp message sent successfully',
      data: data,
    });
  } catch (error) {
    console.error('❌ WhatsApp send error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;