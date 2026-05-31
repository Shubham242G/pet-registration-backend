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

// Create order
router.post('/create-order', auth, async (req, res) => {
  try {
    const { amount, petId, petName } = req.body;

    const shortPetId = petId.slice(-8);
    const shortTimestamp = Date.now().toString().slice(-8);
    const receipt = `pet_${shortPetId}_${shortTimestamp}`;

    const options = {
      amount: amount * 100,
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

// Verify payment
router.post('/verify-payment', auth, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      petId,
      amount,
    } = req.body;

    // Verify Razorpay signature — this is the real security check
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // FIX: Set registrationStatus to 'payment_completed' (valid enum value).
    // Also removed isRegistered:true — that should only be set by admin, not here.
    await Pet.findByIdAndUpdate(petId, {
      paymentStatus: 'completed',
      paymentId: razorpay_payment_id,
      paymentOrderId: razorpay_order_id,
      paymentAmount: amount,
      paymentDate: new Date(),
      registrationStage: 1,
      registrationStatus: 'payment_completed', // valid enum, was previously causing silent failures
    });

    // Update registration form payment status
    let registration = await RegistrationForm.findOne({ pet: petId });
    if (registration) {
      registration.paymentStatus = 'completed';
      registration.paymentId = razorpay_payment_id;
      registration.paymentOrderId = razorpay_order_id;
      await registration.save();
    } else {
      registration = new RegistrationForm({
        pet: petId,
        documents: [],
        paymentStatus: 'completed',
        paymentId: razorpay_payment_id,
        paymentOrderId: razorpay_order_id,
      });
      await registration.save();
    }

    // If all 4 documents already uploaded before payment, advance stage
    if (registration.documents && registration.documents.length === 4) {
      await Pet.findByIdAndUpdate(petId, {
        registrationStage: 1,
        registrationStatus: 'documents_uploaded',
      });

      return res.json({
        success: true,
        message: 'Payment verified! All documents already uploaded. You can now submit registration.',
        allDocumentsReady: true,
      });
    }

    return res.json({
      success: true,
      message: 'Payment verified! Please upload your documents to complete registration.',
      allDocumentsReady: false,
      uploadedDocumentsCount: registration.documents?.length || 0,
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Check payment status
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