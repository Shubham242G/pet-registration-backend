// routes/payment.js
const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const Pet = require('../models/Pet');
const RegistrationForm = require('../models/RegsitrationForm');
const User = require('../models/User');

// ✅ Import WhatsApp service
const { sendPaymentReceiptWhatsApp } = require('../servcies/whatsappService');

// Initialize Razorpay
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

// ─── STRICT PRICE VALIDATION FUNCTION ──────────────────────────────────
function getExpectedPrice(city) {
  const VALID_CITIES = ['ghaziabad', 'delhi', 'noida', 'gurgaon', 'faridabad'];
  const cityLower = city?.toLowerCase() || '';
  
  // ❌ BLOCK invalid cities
  if (!VALID_CITIES.includes(cityLower)) {
    throw new Error(`Invalid city: ${city}. No price configured.`);
  }
  
  let basePrice = 0;
  
  if (['ghaziabad', 'gurgaon'].includes(cityLower)) {
    basePrice = 1500;
  } else if (['delhi', 'noida'].includes(cityLower)) {
    basePrice = 799;
  } else if (cityLower === 'faridabad') {
    basePrice = 1799;
  }
  
  if (basePrice === 0) {
    throw new Error(`No price configured for city: ${city}`);
  }
  
  // Add 18% GST
  return basePrice * 1.18;
}

// ─── SEND PAYMENT RECEIPT ──────────────────────────────────────────────
async function sendPaymentReceipt(user, pet, paymentDetails) {
  const { amount, paymentId, city, tagDeliveryOption, tagDeliveryCost } = paymentDetails;
  
  try {
    const phoneNumber = user.whatsappNumber || user.mobile;
    
    console.log(`📱 Sending payment receipt to ${phoneNumber}`);
    
    const result = await sendPaymentReceiptWhatsApp(
      phoneNumber,
      pet.name,
      amount,
      paymentId,
      city,
      tagDeliveryOption,
      tagDeliveryCost
    );
    
    if (result.success) {
      console.log('📬 WhatsApp payment receipt sent successfully');
    } else {
      console.error('❌ WhatsApp payment receipt failed:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Payment receipt error:', error);
    return { success: false, error: error.message };
  }
}

// ─── TEST ENDPOINT ──────────────────────────────────────────────────────────
router.get('/test', auth, async (req, res) => {
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

    if (!petId) {
      console.error('❌ Missing petId');
      return res.status(400).json({ success: false, error: 'Pet ID is required' });
    }

    const parsedAmount = parseFloat(amount);
    console.log(`💰 Amount received: ${amount} -> ${parsedAmount}`);
    
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      console.error(`❌ Invalid amount: ${amount}`);
      return res.status(400).json({ 
        success: false, 
        error: `Invalid amount: ${amount}` 
      });
    }

    const pet = await Pet.findOne({ _id: petId, owner: userId });
    if (!pet) {
      console.error(`❌ Pet not found: ${petId} for user ${userId}`);
      return res.status(404).json({ success: false, error: 'Pet not found' });
    }

    console.log(`✅ Pet found: ${pet.name}, City: ${pet.city}`);

    // ✅ STRICT PRICE VALIDATION - BLOCK wrong prices
    const expectedPrice = getExpectedPrice(pet.city);
    const tolerance = 1; // Allow ₹1 tolerance for rounding
    
    if (Math.abs(parsedAmount - expectedPrice) > tolerance) {
      console.error(`❌ PRICE MISMATCH: Received ₹${parsedAmount}, Expected ₹${expectedPrice} for city ${pet.city}`);
      return res.status(400).json({ 
        success: false, 
        error: `Invalid amount for ${pet.city}. Expected ₹${expectedPrice.toFixed(2)}. Please contact support.`,
        details: {
          received: parsedAmount,
          expected: expectedPrice,
          city: pet.city
        }
      });
    }

    await Pet.findByIdAndUpdate(petId, {
      'tagDelivery.option': tagDeliveryOption || 'collect_from_municipal',
      'tagDelivery.cost': tagDeliveryCost || 0,
    });

    const finalAmount = parsedAmount;
    const amountInPaise = Math.round(finalAmount * 100);
    console.log(`💰 ₹${finalAmount} -> ${amountInPaise} paise`);

    if (amountInPaise < 100) {
      return res.status(400).json({ 
        success: false, 
        error: 'Minimum payment amount is ₹1.00' 
      });
    }

    const receipt = `TL${petId.slice(-8)}${Date.now().toString().slice(-8)}`;

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt,
      notes: {
        petId,
        petName: petName || pet.name,
        userId: userId.toString(),
        city: pet.city || "ghaziabad",
        tagDeliveryOption: tagDeliveryOption || "collect_from_municipal",
        tagDeliveryCost: tagDeliveryCost || 0,
        verifiedPrice: finalAmount,
        expectedPrice: expectedPrice,
      },
    };

    console.log("========== CREATING RAZORPAY ORDER ==========");
    const order = await razorpay.orders.create(options);
    console.log("✅ ORDER CREATED:", order.id);

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
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create order',
      statusCode: error.statusCode,
      error: error.error,
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

    // Update registration form
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

    // ─── SEND WHATSAPP RECEIPT ──────────────────────────────────────────
    const user = await User.findById(req.user._id);
    
    if (user) {
      const paymentDetails = {
        amount: updateData.paymentAmount || amount / 100,
        paymentId: razorpay_payment_id,
        city: pet.city,
        tagDeliveryOption: tagDeliveryOption || pet.tagDelivery?.option || 'collect_from_municipal',
        tagDeliveryCost: tagDeliveryCost || pet.tagDelivery?.cost || 0,
      };

      // Send WhatsApp receipt in the background
      sendPaymentReceipt(user, pet, paymentDetails)
        .then(result => {
          if (result.success) {
            console.log('📬 WhatsApp payment receipt sent successfully');
          } else {
            console.error('❌ WhatsApp payment receipt failed:', result.error);
          }
        })
        .catch(err => {
          console.error('❌ Receipt sending error:', err);
        });
    }

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

// ─── TEST WHATSAPP RECEIPT ──────────────────────────────────────────────
router.post('/test-receipt', auth, async (req, res) => {
  try {
    const { petId } = req.body;
    
    if (!petId) {
      return res.status(400).json({ success: false, error: 'Pet ID is required' });
    }
    
    const pet = await Pet.findOne({ _id: petId, owner: req.user._id });
    if (!pet) {
      return res.status(404).json({ success: false, error: 'Pet not found' });
    }
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const paymentDetails = {
      amount: pet.paymentAmount || 1500,
      paymentId: pet.paymentId || 'TEST-123',
      city: pet.city || 'ghaziabad',
      tagDeliveryOption: pet.tagDelivery?.option || 'collect_from_municipal',
      tagDeliveryCost: pet.tagDelivery?.cost || 0,
    };
    
    const result = await sendPaymentReceipt(user, pet, paymentDetails);
    
    res.json({
      success: true,
      message: 'Test receipt sent',
      result: result,
    });
  } catch (error) {
    console.error('❌ Test receipt error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;