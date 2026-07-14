// routes/payment.js
const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const Pet = require('../models/Pet');
const RegistrationForm = require('../models/RegsitrationForm');
const User = require('../models/User');

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

// ─── SEND NOTIFICATION FUNCTION ──────────────────────────────────────────
async function sendPaymentNotifications(user, pet, paymentDetails) {
  const notifications = [];
  
  // 1. Send WhatsApp Message
  try {
    const whatsappResult = await sendWhatsAppPaymentConfirmation(user, pet, paymentDetails);
    notifications.push({ type: 'whatsapp', success: true, result: whatsappResult });
  } catch (error) {
    console.error('❌ WhatsApp notification failed:', error);
    notifications.push({ type: 'whatsapp', success: false, error: error.message });
  }
  
  // 2. Send Email
  try {
    const emailResult = await sendEmailPaymentConfirmation(user, pet, paymentDetails);
    notifications.push({ type: 'email', success: true, result: emailResult });
  } catch (error) {
    console.error('❌ Email notification failed:', error);
    notifications.push({ type: 'email', success: false, error: error.message });
  }
  
  return notifications;
}

// ─── SEND WHATSAPP PAYMENT CONFIRMATION ──────────────────────────────────
async function sendWhatsAppPaymentConfirmation(user, pet, paymentDetails) {
  const { amount, paymentId, orderId, city, tagDeliveryOption, tagDeliveryCost, registrationTriggered } = paymentDetails;
  
  // Format amount
  const formattedAmount = `₹${Number(amount).toFixed(2)}`;
  
  // City display name
  const cityNames = {
    ghaziabad: 'Ghaziabad',
    delhi: 'Delhi',
    noida: 'Noida',
    gurgaon: 'Gurgaon',
    faridabad: 'Faridabad',
    other: 'Other'
  };
  const cityDisplay = cityNames[city] || city || 'Not specified';
  
  // Tag delivery display
  const tagDeliveryDisplay = tagDeliveryOption === 'deliver_to_home' 
    ? `🏠 Deliver to Home (₹${tagDeliveryCost || 0})` 
    : '🏛️ Collect from Municipal Office';
  
  // Build the WhatsApp message
  const message = `
🐾 *Tailio - Payment Confirmation*

Hi ${user.name || 'Pet Parent'},

✅ Your payment of *${formattedAmount}* has been successfully received!

📋 *Registration Details:*
━━━━━━━━━━━━━━━━━━━━
🐕 Pet Name: *${pet.name}*
📍 City: *${cityDisplay}*
📅 Date: *${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}*
🕐 Time: *${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}*

💳 *Payment Information:*
━━━━━━━━━━━━━━━━━━━━
💰 Amount: *${formattedAmount}*
🆔 Payment ID: *${paymentId || 'N/A'}*
📦 Order ID: *${orderId || 'N/A'}*

📦 *Tag Delivery:*
━━━━━━━━━━━━━━━━━━━━
${tagDeliveryDisplay}

📄 *Registration Status:*
━━━━━━━━━━━━━━━━━━━━
${registrationTriggered ? '✅ Registration Submitted Successfully' : '⏳ Registration Pending'}

🔹 *Next Steps:*
━━━━━━━━━━━━━━━━━━━━
• Your registration is being processed
• You'll receive the official certificate within 24-72 hours
• A confirmation email has been sent to your registered email
• You'll receive a WhatsApp notification once the certificate is ready

💚 *Thank you for choosing Tailio!*

*Need help?* Contact us at +91 95609 87196

*Tailio* - Making pet registration simple
`;

  // Send WhatsApp via your API
  const whatsappApiUrl = process.env.WHATSAPP_API_URL || 'http://localhost:5000/api/whatsapp/send-message';
  
  // Use your existing WhatsApp API
  const response = await fetch(whatsappApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phoneNumber: user.whatsappNumber || user.mobile,
      message: message,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`WhatsApp API error: ${response.statusText}`);
  }
  
  return await response.json();
}

// ─── SEND EMAIL PAYMENT CONFIRMATION ─────────────────────────────────────
async function sendEmailPaymentConfirmation(user, pet, paymentDetails) {
  const { amount, paymentId, orderId, city, tagDeliveryOption, tagDeliveryCost, registrationTriggered } = paymentDetails;
  
  // Format amount
  const formattedAmount = `₹${Number(amount).toFixed(2)}`;
  
  // City display name
  const cityNames = {
    ghaziabad: 'Ghaziabad',
    delhi: 'Delhi',
    noida: 'Noida',
    gurgaon: 'Gurgaon',
    faridabad: 'Faridabad',
    other: 'Other'
  };
  const cityDisplay = cityNames[city] || city || 'Not specified';
  
  // Tag delivery display
  const tagDeliveryDisplay = tagDeliveryOption === 'deliver_to_home' 
    ? `Deliver to Home (₹${tagDeliveryCost || 0})` 
    : 'Collect from Municipal Office';
  
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Confirmation - Tailio</title>
      <style>
        body { font-family: Arial, sans-serif; background-color: #FAF6EF; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(44,26,14,0.1); }
        .header { background: #2C1A0E; padding: 24px; text-align: center; }
        .header h1 { color: #F4E4CF; margin: 0; font-size: 24px; }
        .header .subtitle { color: #F4E4CF/60; font-size: 14px; margin-top: 4px; }
        .content { padding: 32px 24px; }
        .greeting { font-size: 18px; color: #2C1A0E; margin-bottom: 8px; }
        .amount-box { background: #E8600A; color: white; padding: 16px; border-radius: 12px; text-align: center; margin: 16px 0; }
        .amount-box .amount { font-size: 32px; font-weight: bold; }
        .amount-box .label { font-size: 14px; opacity: 0.9; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #F3EDE0; }
        .detail-row .label { color: #7A5C40; font-size: 14px; }
        .detail-row .value { color: #2C1A0E; font-weight: 600; font-size: 14px; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .status-success { background: #E6F6ED; color: #1A6B3A; }
        .status-pending { background: #FFF4E4; color: #B85C00; }
        .footer { background: #FAF6EF; padding: 20px; text-align: center; border-top: 1px solid #F3EDE0; }
        .footer .text { color: #7A5C40; font-size: 12px; margin: 4px 0; }
        .footer .brand { color: #2C1A0E; font-weight: 600; }
        .support-link { color: #E8600A; text-decoration: none; font-weight: 600; }
        .next-steps { background: #FFFCF8; border-radius: 12px; padding: 16px; margin: 16px 0; border: 1px solid #F3EDE0; }
        .next-steps .step { display: flex; align-items: center; gap: 12px; padding: 6px 0; color: #2C1A0E; font-size: 14px; }
        .next-steps .step::before { content: "✓"; color: #1A6B3A; font-weight: bold; font-size: 16px; }
        @media (max-width: 480px) { .content { padding: 20px 16px; } .detail-row { flex-direction: column; gap: 4px; } .amount-box .amount { font-size: 24px; } }
      </style>
    </head>
    <body style="margin: 0; padding: 20px; background: #FAF6EF;">
      <div class="container">
        <div class="header">
          <h1>🐾 Payment Confirmed</h1>
          <div class="subtitle">Tailio Pet Registration</div>
        </div>
        <div class="content">
          <div class="greeting">Hi ${user.name || 'Pet Parent'},</div>
          <p style="color: #7A5C40; font-size: 15px; line-height: 1.6;">
            Your payment has been successfully received. Here are your registration details:
          </p>
          
          <div class="amount-box">
            <div class="label">Amount Paid</div>
            <div class="amount">${formattedAmount}</div>
          </div>
          
          <div style="margin: 16px 0;">
            <div class="detail-row">
              <span class="label">Pet Name</span>
              <span class="value">${pet.name}</span>
            </div>
            <div class="detail-row">
              <span class="label">City</span>
              <span class="value">${cityDisplay}</span>
            </div>
            <div class="detail-row">
              <span class="label">Payment ID</span>
              <span class="value" style="font-size: 12px; word-break: break-all;">${paymentId || 'N/A'}</span>
            </div>
            <div class="detail-row">
              <span class="label">Order ID</span>
              <span class="value" style="font-size: 12px; word-break: break-all;">${orderId || 'N/A'}</span>
            </div>
            <div class="detail-row">
              <span class="label">Tag Delivery</span>
              <span class="value">${tagDeliveryDisplay}</span>
            </div>
            <div class="detail-row">
              <span class="label">Registration Status</span>
              <span class="value">
                <span class="status-badge ${registrationTriggered ? 'status-success' : 'status-pending'}">
                  ${registrationTriggered ? '✅ Submitted Successfully' : '⏳ Pending'}
                </span>
              </span>
            </div>
          </div>
          
          <div class="next-steps">
            <div style="font-weight: 600; color: #2C1A0E; margin-bottom: 8px;">📋 Next Steps</div>
            <div class="step">Your registration is being processed</div>
            <div class="step">You'll receive the official certificate within 24-72 hours</div>
            <div class="step">Check your WhatsApp for real-time updates</div>
            <div class="step">Download your certificate from the Tailio dashboard</div>
          </div>
          
          <p style="color: #7A5C40; font-size: 14px; line-height: 1.6; margin-top: 16px;">
            <strong>Need help?</strong> Contact us at 
            <a href="tel:+919560987196" style="color: #E8600A; text-decoration: none; font-weight: 600;">+91 95609 87196</a>
          </p>
        </div>
        <div class="footer">
          <div class="brand">🐾 Tailio</div>
          <div class="text">Making pet registration simple</div>
          <div class="text">© ${new Date().getFullYear()} Tailio. All rights reserved.</div>
        </div>
      </div>
    </body>
    </html>
  `;

  // Send email via your email service
  const emailApiUrl = process.env.EMAIL_API_URL || 'http://localhost:5000/api/email/send';
  
  const response = await fetch(emailApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: user.email,
      subject: `🐾 Payment Confirmation - ${pet.name} - Tailio`,
      html: emailHtml,
      text: `
        Payment Confirmed - Tailio
        
        Hi ${user.name || 'Pet Parent'},
        
        Your payment of ${formattedAmount} has been successfully received.
        
        Registration Details:
        - Pet Name: ${pet.name}
        - City: ${cityDisplay}
        - Payment ID: ${paymentId || 'N/A'}
        - Order ID: ${orderId || 'N/A'}
        - Tag Delivery: ${tagDeliveryDisplay}
        - Status: ${registrationTriggered ? 'Submitted Successfully' : 'Pending'}
        
        Next Steps:
        - Your registration is being processed
        - You'll receive the official certificate within 24-72 hours
        - Check your WhatsApp for real-time updates
        
        Need help? Contact us at +91 95609 87196
        
        Tailio - Making pet registration simple
      `,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Email API error: ${response.statusText}`);
  }
  
  return await response.json();
}
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
    console.log(`💰 Amount: ${amount} -> ${parsedAmount}`);
    
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

    console.log(`✅ Pet found: ${pet.name}`);

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
        city: pet.city || "other",
        tagDeliveryOption: tagDeliveryOption || "collect_from_municipal",
        tagDeliveryCost: tagDeliveryCost || 0,
      },
    };

    console.log("========== RAZORPAY TEST ==========");
    const order = await razorpay.orders.create(options);
    console.log("ORDER CREATED");

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
    console.error("statusCode:", error.statusCode);
    console.error("error:", error.error);
    console.error("message:", error.message);
    console.error("stack:", error.stack);

    return res.status(500).json({
      success: false,
      message: error.message,
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

    // ─── SEND NOTIFICATIONS ──────────────────────────────────────────────
    // Get user details
    const user = await User.findById(req.user._id);
    
    if (user) {
      // Check if registration is triggered
      const registrationForm = await RegistrationForm.findOne({ pet: petId });
      const isRegistrationTriggered = registrationForm?.registrationTriggered || false;

      // Send notifications
      const paymentDetails = {
        amount: updateData.paymentAmount || amount / 100,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        city: pet.city,
        tagDeliveryOption: tagDeliveryOption || pet.tagDelivery?.option || 'collect_from_municipal',
        tagDeliveryCost: tagDeliveryCost || pet.tagDelivery?.cost || 0,
        registrationTriggered: isRegistrationTriggered,
      };

      // Send notifications asynchronously (don't wait for them)
      sendPaymentNotifications(user, pet, paymentDetails)
        .then(results => {
          console.log('📬 Notification results:', results);
        })
        .catch(err => {
          console.error('❌ Notification sending failed:', err);
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

module.exports = router;