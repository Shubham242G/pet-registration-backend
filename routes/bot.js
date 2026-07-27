// routes/bot.js
const express = require('express');
const router = express.Router();
const BotService = require('../services/botService');
const BotSession = require('../models/BotSession');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');

// ─── WEBHOOK - Receive messages from Wapp.biz ────────────────────────────
router.post('/webhook', async (req, res) => {
  try {
    console.log('📨 Bot webhook received:', JSON.stringify(req.body, null, 2));
    
    const { phone, message, media_url } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number required' });
    }
    
    // Process the message
    const response = await BotService.processMessage(phone, message, media_url);
    
    // Send response back to WhatsApp
    // You'll need to implement sendWhatsAppResponse using your existing service
    await sendWhatsAppResponse(phone, response);
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Bot webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── SEND WHATSAPP RESPONSE ──────────────────────────────────────────────
async function sendWhatsAppResponse(phone, message) {
  try {
    // Use your existing WhatsApp service
    const { sendWhatsAppMessage } = require('../services/whatsappService');
    
    // Clean phone number
    let cleanPhone = phone.toString().replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }
    
    // Use the sendTextMessage function (you may need to implement this)
    // For now, we'll use the existing sendPaymentReceiptWhatsApp as a template
    const result = await sendWhatsAppMessage(cleanPhone, message);
    return result;
  } catch (error) {
    console.error('❌ Error sending WhatsApp response:', error);
    return { success: false, error: error.message };
  }
}

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
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('❌ Error fetching bot users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── ADMIN: GET BOT ANALYTICS ─────────────────────────────────────────────
router.get('/admin/analytics', auth, requireRole('admin'), async (req, res) => {
  try {
    const stats = await BotService.getAdminStats();
    
    // City distribution
    const cityStats = await BotSession.aggregate([
      { $match: { 'userData.city': { $ne: null } } },
      { $group: { _id: '$userData.city', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Step distribution
    const stepStats = await BotSession.aggregate([
      { $group: { _id: '$currentStep', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Daily stats (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const dailyStats = await BotSession.aggregate([
      { 
        $match: { 
          startedAt: { $gte: sevenDaysAgo } 
        } 
      },
      {
        $group: {
          _id: { 
            $dateToString: { format: '%Y-%m-%d', date: '$startedAt' }
          },
          count: { $sum: 1 },
          converted: { 
            $sum: { $cond: ['$isConverted', 1, 0] } 
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json({
      success: true,
      analytics: {
        ...stats,
        cityDistribution: cityStats,
        stepDistribution: stepStats,
        dailyStats: dailyStats
      }
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
    
    // Check if session has enough data
    if (!session.userData.name || !session.petData.name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Session data incomplete. Name and pet name required.' 
      });
    }
    
    // Convert to full user
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
      user: {
        name: user.name,
        whatsappNumber: user.whatsappNumber,
        city: user.city
      }
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
    
    res.json({
      success: true,
      message: 'Bot session deleted successfully'
    });
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
    
    // Get user and pet if converted
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
    
    const response = await BotService.processMessage(
      phoneNumber, 
      message || 'start'
    );
    
    res.json({
      success: true,
      message: 'Test webhook processed',
      response
    });
  } catch (error) {
    console.error('❌ Test webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;