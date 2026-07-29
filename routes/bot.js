// routes/bot.js
const express = require('express');
const router = express.Router();
const BotService = require('../servcies/botService');
const BotSession = require('../models/BotSession');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');
const { sendWhatsAppTextMessage } = require('../services/whatsappService');

// ─── WAPP.BIZ WEBHOOK - Receive messages ──────────────────────────────────
router.post('/webhook', async (req, res) => {
  try {
    console.log('📨 Wapp.biz webhook received:');
    console.log('📨 Body:', JSON.stringify(req.body, null, 2));
    
    // Wapp.biz sends messages in different formats
    const { phone, message, media_url, event, data } = req.body;
    
    // Extract phone number and message from various formats
    let phoneNumber = phone || data?.phone || req.body?.phone;
    let messageText = message || data?.message || req.body?.message;
    let mediaUrl = media_url || data?.media_url || req.body?.media_url;
    
    if (!phoneNumber) {
      console.error('❌ No phone number in webhook payload');
      return res.status(400).json({ error: 'Phone number required' });
    }
    
    // Clean phone number
    const cleanPhone = phoneNumber.toString().replace(/\D/g, '');
    
    console.log(`📱 Processing message from ${cleanPhone}:`, messageText || 'Media message');
    
    // Process the message through bot service
    const response = await BotService.processMessage(cleanPhone, messageText || '', mediaUrl);
    
    // Send response back via WhatsApp using the correct endpoint
    if (response) {
      await sendWhatsAppTextMessage(cleanPhone, response);
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Message processed'
    });
    
  } catch (error) {
    console.error('❌ Bot webhook error:', error);
    // Always return 200 to Wapp.biz
    return res.status(200).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ─── WEBHOOK VERIFICATION ──────────────────────────────────────────────────
router.get('/webhook', (req, res) => {
  try {
    const { hub_mode, hub_verify_token, hub_challenge } = req.query;
    
    console.log('🔍 Webhook verification request:');
    console.log('  - hub_mode:', hub_mode);
    console.log('  - hub_verify_token:', hub_verify_token);
    console.log('  - hub_challenge:', hub_challenge);
    
    const verifyToken = process.env.WAPP_BIZ_WEBHOOK_VERIFY_TOKEN || 'tailio_webhook_verify';
    
    if (hub_mode === 'subscribe' && hub_verify_token === verifyToken) {
      console.log('✅ Webhook verified successfully!');
      return res.status(200).send(hub_challenge);
    } else {
      console.log('❌ Webhook verification failed');
      return res.status(403).send('Verification failed');
    }
  } catch (error) {
    console.error('❌ Webhook verification error:', error);
    return res.status(500).send('Internal server error');
  }
});

// ─── GET BOT SESSION STATUS ──────────────────────────────────────────────
router.get('/session/:phone', auth, async (req, res) => {
  try {
    const session = await BotSession.findOne({ phoneNumber: req.params.phone });
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    res.json({
      success: true,
      session: {
        currentStep: session.currentStep,
        isComplete: session.isComplete,
        isConverted: session.isConverted,
        userData: session.userData,
        petData: session.petData,
        documents: session.documents,
        documentCount: session.documentCount,
        requiredDocumentCount: session.requiredDocumentCount,
        conversationLog: session.conversationLog.slice(-20)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── ADMIN: GET ALL BOT USERS ─────────────────────────────────────────────
router.get('/admin/bot-users', auth, requireRole('admin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const result = await BotService.getBotUsers(page, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Error fetching bot users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── ADMIN: GET BOT ANALYTICS ─────────────────────────────────────────────
router.get('/admin/analytics', auth, requireRole('admin'), async (req, res) => {
  try {
    const stats = await BotService.getAdminStats();
    
    const cityStats = await BotSession.aggregate([
      { $match: { 'userData.city': { $ne: null } } },
      { $group: { _id: '$userData.city', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const stepStats = await BotSession.aggregate([
      { $group: { _id: '$currentStep', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const dailyStats = await BotSession.aggregate([
      { $match: { startedAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } },
          count: { $sum: 1 },
          converted: { $sum: { $cond: ['$isConverted', 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json({
      success: true,
      analytics: { ...stats, cityDistribution: cityStats, stepDistribution: stepStats, dailyStats }
    });
  } catch (error) {
    console.error('❌ Error fetching bot analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── ADMIN: CONVERT BOT USER TO FULL USER ────────────────────────────────
router.post('/admin/convert/:sessionId', auth, requireRole('admin'), async (req, res) => {
  try {
    const session = await BotSession.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    if (session.isConverted) {
      return res.status(400).json({ success: false, error: 'Already converted' });
    }
    
    if (!session.userData.name || !session.petData.name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Session data incomplete. Name and pet name required.' 
      });
    }
    
    const user = await BotService.createUserAccount(session);
    const pet = await BotService.createPet(session, user);
    await BotService.createRegistrationForm(session, pet);
    
    session.isConverted = true;
    session.userId = user._id;
    session.petId = pet._id;
    session.currentStep = 'complete';
    await session.save();
    
    res.json({
      success: true,
      message: 'User converted successfully',
      userId: user._id,
      petId: pet._id,
      user: { name: user.name, whatsappNumber: user.whatsappNumber, city: user.city }
    });
  } catch (error) {
    console.error('❌ Error converting bot user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── ADMIN: DELETE BOT SESSION ────────────────────────────────────────────
router.delete('/admin/session/:sessionId', auth, requireRole('admin'), async (req, res) => {
  try {
    const session = await BotSession.findByIdAndDelete(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    res.json({ success: true, message: 'Bot session deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting bot session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── ADMIN: GET BOT SESSION DETAILS ──────────────────────────────────────
router.get('/admin/session/:sessionId', auth, requireRole('admin'), async (req, res) => {
  try {
    const session = await BotSession.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    let user = null;
    let pet = null;
    if (session.userId) {
      user = await User.findById(session.userId).select('-password');
    }
    if (session.petId) {
      pet = await Pet.findById(session.petId);
    }
    
    res.json({
      success: true,
      session: {
        ...session.toObject(),
        user,
        pet,
        documentCount: session.documentCount,
        requiredDocumentCount: session.requiredDocumentCount
      }
    });
  } catch (error) {
    console.error('❌ Error fetching bot session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── TEST WEBHOOK ──────────────────────────────────────────────────────────
router.post('/test-webhook', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number required' });
    }
    const response = await BotService.processMessage(phoneNumber, message || 'start');
    res.json({ success: true, message: 'Test webhook processed', response });
  } catch (error) {
    console.error('❌ Test webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── WEBHOOK STATUS ──────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'Bot webhook is active',
    webhookUrl: `${req.protocol}://${req.get('host')}/api/bot/webhook`,
    endpoints: {
      webhook: 'POST /api/bot/webhook',
      verify: 'GET /api/bot/webhook',
      status: 'GET /api/bot/status',
      session: 'GET /api/bot/session/:phone',
      test: 'POST /api/bot/test-webhook'
    }
  });
});

module.exports = router;