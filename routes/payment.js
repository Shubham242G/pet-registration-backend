const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const Pet = require('../models/Pet');
const RegistrationForm = require('../models/RegsitrationForm');
const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create order (Backend) - FIXED receipt length issue
router.post('/create-order', auth, async (req, res) => {
  try {
    const { amount, petId, petName } = req.body;

    // Create a shorter receipt ID (max 40 chars)
    const shortPetId = petId.slice(-8);
    const shortTimestamp = Date.now().toString().slice(-8);
    const receipt = `pet_${shortPetId}_${shortTimestamp}`; // ~25 chars, well within 40 char limit

    const options = {
      amount: amount * 100, // Convert to paise (₹999 = 99900 paise)
      currency: 'INR',
      receipt: receipt,
      notes: {
        petId: petId,
        petName: petName,
        userId: req.user._id.toString(),
      },
    };

    const order = await razorpay.orders.create(options);
    
    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Verify payment (Backend)
router.post('/verify-payment', auth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, petId } = req.body;

    // Verify signature
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Update pet payment status in database
    await Pet.findByIdAndUpdate(petId, {
      paymentStatus: 'completed',
      paymentId: razorpay_payment_id,
      paymentOrderId: razorpay_order_id,
      paymentAmount: 99900, // in paise
      paymentDate: new Date(),
      registrationStage: 2, // Move to next stage
    });

    // Also update registration form payment status
    const registration = await RegistrationForm.findOne({ pet: petId });
    if (registration) {
      registration.paymentStatus = 'completed';
      registration.paymentId = razorpay_payment_id;
      registration.paymentOrderId = razorpay_order_id;
      await registration.save();
    }

    res.json({ success: true, message: 'Payment verified successfully' });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Check payment status (Backend)
router.get('/payment-status/:petId', auth, async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.petId);
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    res.json({
      paymentStatus: pet.paymentStatus || 'pending',
      paymentAmount: pet.paymentAmount,
      paymentDate: pet.paymentDate,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get payment status' });
  }
});

module.exports = router;