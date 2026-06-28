const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const Pet = require('../models/Pet');
const RegistrationForm = require('../models/RegsitrationForm');

// ✅ Debug: Log environment variables at startup
console.log('🔧 Payment route initialization');

console.log('📌 NODE_ENV:', process.env.NODE_ENV);

// Initialize Razorpay with better error handling
let razorpay = null;
try {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    console.log('✅ Razorpay initialized successfully');
    

  } else {
    console.error('❌ Razorpay keys missing!');
  }
} catch (error) {
  console.error('❌ Failed to initialize Razorpay:', error.message);
  razorpay = null;
}

// ─── TEST ENDPOINT ──────────────────────────────────────────────────────────
router.get('/test', async (req, res) => {
  try {
    res.json({
      success: true,
      razorpay_initialized: !!razorpay,
      key_id_present: !!process.env.RAZORPAY_KEY_ID,
      key_secret_present: !!process.env.RAZORPAY_KEY_SECRET,
      key_id: process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.substring(0, 10) + '...' : 'missing',
      environment: process.env.NODE_ENV || 'unknown',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── CREATE ORDER ──────────────────────────────────────────────────────────
router.post('/create-order', auth, async (req, res) => {
  try {
    console.log("======= PAYMENT ROUTE HIT =======");
    console.log('📦 Payment order request received');
    console.log('📌 Request body:', JSON.stringify(req.body, null, 2));
    console.log('📌 User ID:', req.user?._id);
    
    // ✅ Check if Razorpay is initialized
    if (!razorpay) {
      console.error('❌ Razorpay not initialized. Keys missing?');
      return res.status(500).json({ 
        success: false, 
        error: 'Payment service is not configured. Please contact support.',
        details: 'Razorpay not initialized'
      });
    }

    const { amount, petId, petName, tagDeliveryOption, tagDeliveryCost } = req.body;
    const userId = req.user._id;

    // ✅ Validate required fields
    if (!petId) {
      console.error('❌ Missing petId');
      return res.status(400).json({ success: false, error: 'Pet ID is required' });
    }

    // ✅ Validate amount
    const parsedAmount = parseFloat(amount);
    console.log(`💰 Amount: ${amount} -> ${parsedAmount}`);
    
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      console.error(`❌ Invalid amount: ${amount}`);
      return res.status(400).json({ 
        success: false, 
        error: `Invalid amount: ${amount}` 
      });
    }

    // Validate pet belongs to user
    const pet = await Pet.findOne({ _id: petId, owner: userId });
    if (!pet) {
      console.error(`❌ Pet not found: ${petId} for user ${userId}`);
      return res.status(404).json({ success: false, error: 'Pet not found' });
    }

    console.log(`✅ Pet found: ${pet.name}`);

    // Update pet with tag delivery info
    await Pet.findByIdAndUpdate(petId, {
      'tagDelivery.option': tagDeliveryOption || 'collect_from_municipal',
      'tagDelivery.cost': tagDeliveryCost || 0,
    });

    // Convert to paise
    const finalAmount = parsedAmount;
    const amountInPaise = Math.round(finalAmount * 100);
    console.log(`💰 ₹${finalAmount} -> ${amountInPaise} paise`);

    if (amountInPaise < 100) {
      return res.status(400).json({ 
        success: false, 
        error: 'Minimum payment amount is ₹1.00' 
      });
    }

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_${petId}_${Date.now()}`,
      payment_capture: 1,
      notes: {
        petId: petId,
        petName: petName || pet.name,
        userId: userId.toString(),
        city: pet.city || 'other',
        tagDeliveryOption: tagDeliveryOption || 'collect_from_municipal',
        tagDeliveryCost: tagDeliveryCost || 0,
      },
    };

    console.log("========== RAZORPAY TEST ==========");
    const order = await razorpay.orders.create(options);
     console.log("ORDER CREATED");
  console.log(order);

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
    console.log("========== RAZORPAY ERROR ==========");
  console.log(err);
  console.log("statusCode:", err.statusCode);
  console.log("error:", err.error);
  console.log("response:", err.response);
  throw err;
    
    // Send detailed error for debugging
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create order',
      details: error.error || error.message,
      statusCode: error.statusCode || 500,
      // Only include stack in development
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

// ─── VERIFY PAYMENT ──────────────────────────────────────────────────────
router.post('/verify-payment', auth, async (req, res) => {
  try {
    console.log('📦 Payment verification request received');
    
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      petId,
      amount,
      tagDeliveryOption,
      tagDeliveryCost,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing payment verification data' 
      });
    }

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.error('❌ Invalid signature');
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

    console.log(`✅ Payment verified for pet ${petId}`);
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
    console.error('❌ Payment verification error:', error);
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