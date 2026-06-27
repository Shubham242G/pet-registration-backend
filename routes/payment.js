const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const Pet = require('../models/Pet');
const RegistrationForm = require('../models/RegsitrationForm');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─── CREATE ORDER ──────────────────────────────────────────────────────────
router.post('/create-order', auth, async (req, res) => {
  try {
    const { amount, petId, petName, tagDeliveryOption, tagDeliveryCost } = req.body;
    const userId = req.user._id;

    // Validate pet belongs to user
    const pet = await Pet.findOne({ _id: petId, owner: userId });
    if (!pet) {
      return res.status(404).json({ success: false, error: 'Pet not found' });
    }

    // ✅ Update pet with tag delivery info
    await Pet.findByIdAndUpdate(petId, {
      'tagDelivery.option': tagDeliveryOption || 'collect_from_municipal',
      'tagDelivery.cost': tagDeliveryCost || 0,
    });

    const finalAmount = amount || 999;

    const options = {
      amount: Math.round(finalAmount * 100),
      currency: 'INR',
      receipt: `receipt_${petId}_${Date.now()}`,
      notes: {
        petId: petId,
        petName: petName || pet.name,
        userId: userId.toString(),
        city: pet.city || 'other',
        tagDeliveryOption: tagDeliveryOption || 'collect_from_municipal',
        tagDeliveryCost: tagDeliveryCost || 0,
      },
    };

    const order = await razorpay.orders.create(options);

    await Pet.findByIdAndUpdate(petId, {
      paymentOrderId: order.id,
      paymentAmount: finalAmount,
      paymentStatus: 'pending',
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── VERIFY PAYMENT ──────────────────────────────────────────────────────
router.post('/verify-payment', auth, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      petId,
      amount,
      tagDeliveryOption,
      tagDeliveryCost,
    } = req.body;

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Invalid signature' });
    }

    const updateData = {
      paymentStatus: 'completed',
      paymentId: razorpay_payment_id,
      paymentDate: new Date(),
    };

    if (amount) {
      updateData.paymentAmount = amount / 100;
    }

    // ✅ Also update tag delivery info if provided
    if (tagDeliveryOption) {
      updateData['tagDelivery.option'] = tagDeliveryOption;
      updateData['tagDelivery.cost'] = tagDeliveryCost || 0;
    }

    const pet = await Pet.findByIdAndUpdate(
      petId,
      updateData,
      { new: true }
    );

    if (!pet) {
      return res.status(404).json({ success: false, error: 'Pet not found' });
    }

    await RegistrationForm.findOneAndUpdate(
      { pet: petId },
      { 
        paymentStatus: 'completed',
        paymentId: razorpay_payment_id,
        tagDeliveryOption: tagDeliveryOption || 'collect_from_municipal',
        tagDeliveryCost: tagDeliveryCost || 0,
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Payment verified successfully',
      pet: {
        id: pet._id,
        name: pet.name,
        city: pet.city,
        paymentStatus: pet.paymentStatus,
        tagDelivery: pet.tagDelivery,
      },
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GET PAYMENT STATUS ──────────────────────────────────────────────────
router.get('/status/:petId', auth, async (req, res) => {
  try {
    const pet = await Pet.findOne({
      _id: req.params.petId,
      owner: req.user._id,
    });

    if (!pet) {
      return res.status(404).json({ success: false, error: 'Pet not found' });
    }

    res.json({
      success: true,
      paymentStatus: pet.paymentStatus,
      paymentId: pet.paymentId,
      paymentOrderId: pet.paymentOrderId,
      paymentAmount: pet.paymentAmount,
      paymentDate: pet.paymentDate,
      city: pet.city,
      tagDelivery: pet.tagDelivery,
      isSterilizationRequired: pet.isSterilizationRequired,
    });
  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;