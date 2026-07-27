// services/botService.js
const BotSession = require('../models/BotSession');
const User = require('../models/User');
const Pet = require('../models/Pet');
const RegistrationForm = require('../models/RegsitrationForm');
const { sendWhatsAppMessage } = require('./whatsappService');

const CITY_OPTIONS = ['Delhi', 'Noida', 'Ghaziabad', 'Gurgaon', 'Faridabad'];
const DOC_STEPS = [
  { step: 'ask_document_anti_rabies', key: 'antiRabiesCertificate', label: 'Anti-Rabies Certificate' },
  { step: 'ask_document_id_proof', key: 'idProof', label: 'ID Proof' },
  { step: 'ask_document_residence_proof', key: 'residenceProof', label: 'Residence Proof' },
  { step: 'ask_document_owner_photo', key: 'ownerWithPetPhoto', label: 'Owner with Pet Photo' },
  { step: 'ask_document_pet_photo', key: 'petPhoto', label: 'Pet Photo' },
  { step: 'ask_document_vaccination_card', key: 'vaccinationCard', label: 'Vaccination Card' },
];

class BotService {
  
  // ─── GET OR CREATE SESSION ──────────────────────────────────────────────
  async getOrCreateSession(phoneNumber) {
    let session = await BotSession.findOne({ phoneNumber });
    if (!session) {
      session = new BotSession({ phoneNumber });
      await session.save();
      console.log(`🆕 New bot session created for ${phoneNumber}`);
    }
    return session;
  }

  // ─── PROCESS INCOMING MESSAGE ───────────────────────────────────────────
  async processMessage(phoneNumber, message, mediaUrl = null) {
    const session = await this.getOrCreateSession(phoneNumber);
    
    // Log incoming message
    session.conversationLog.push({
      direction: 'incoming',
      message: message,
      timestamp: new Date()
    });
    session.lastMessageAt = new Date();
    await session.save();

    // Handle document/media upload
    if (mediaUrl) {
      return await this.handleDocumentUpload(session, message, mediaUrl);
    }

    // Route based on current step
    let response;
    switch (session.currentStep) {
      case 'welcome':
        response = await this.handleWelcome(session, message);
        break;
      case 'ask_name':
        response = await this.handleAskName(session, message);
        break;
      case 'ask_pet_name':
        response = await this.handleAskPetName(session, message);
        break;
      case 'ask_pet_age':
        response = await this.handleAskPetAge(session, message);
        break;
      case 'ask_pet_breed':
        response = await this.handleAskPetBreed(session, message);
        break;
      case 'ask_gender':
        response = await this.handleAskGender(session, message);
        break;
      case 'ask_city':
        response = await this.handleAskCity(session, message);
        break;
      case 'ask_document_anti_rabies':
      case 'ask_document_id_proof':
      case 'ask_document_residence_proof':
      case 'ask_document_owner_photo':
      case 'ask_document_pet_photo':
      case 'ask_document_vaccination_card':
        response = await this.handleDocumentRequest(session, message);
        break;
      case 'ask_payment':
        response = await this.handlePayment(session, message);
        break;
      default:
        response = this.getDefaultResponse(session);
    }

    // Log outgoing message
    session.conversationLog.push({
      direction: 'outgoing',
      message: response,
      timestamp: new Date()
    });
    session.lastMessageAt = new Date();
    await session.save();

    return response;
  }

  // ─── HANDLE WELCOME ──────────────────────────────────────────────────────
  async handleWelcome(session, message) {
    // If user says "start" or "hi" or "hello", move to next step
    const greetings = ['hi', 'hello', 'hey', 'start', 'register', 'help'];
    if (greetings.some(g => message.toLowerCase().includes(g))) {
      session.currentStep = 'ask_name';
      await session.save();
      return this.getStepMessage('ask_name');
    }
    
    return `🐾 *Welcome to Tailio!* 

I'm your pet registration assistant. 🐶

I'll help you register your pet in just a few minutes. 

Type *"start"* or *"register"* to begin!`;
  }

  // ─── HANDLE NAME ─────────────────────────────────────────────────────────
  async handleAskName(session, message) {
    session.userData.name = message.trim();
    session.currentStep = 'ask_pet_name';
    await session.save();
    return this.getStepMessage('ask_pet_name', { name: message.trim() });
  }

  // ─── HANDLE PET NAME ─────────────────────────────────────────────────────
  async handleAskPetName(session, message) {
    session.petData.name = message.trim();
    session.currentStep = 'ask_pet_age';
    await session.save();
    return this.getStepMessage('ask_pet_age', { petName: message.trim() });
  }

  // ─── HANDLE PET AGE ──────────────────────────────────────────────────────
  async handleAskPetAge(session, message) {
    // Parse age input
    let years = 0, months = 0;
    const ageText = message.toLowerCase();
    
    const yearMatch = ageText.match(/(\d+)\s*years?/);
    const monthMatch = ageText.match(/(\d+)\s*months?/);
    
    if (yearMatch) years = parseInt(yearMatch[1]);
    if (monthMatch) months = parseInt(monthMatch[1]);
    
    // If just a number, treat as years
    if (!yearMatch && !monthMatch) {
      const num = parseInt(ageText);
      if (!isNaN(num)) years = num;
    }
    
    session.petData.ageYears = years;
    session.petData.ageMonths = months;
    session.currentStep = 'ask_pet_breed';
    await session.save();
    
    return this.getStepMessage('ask_pet_breed', { 
      age: `${years} years ${months} months` 
    });
  }

  // ─── HANDLE PET BREED ────────────────────────────────────────────────────
  async handleAskPetBreed(session, message) {
    session.petData.breed = message.trim();
    session.currentStep = 'ask_gender';
    await session.save();
    return this.getStepMessage('ask_gender');
  }

  // ─── HANDLE GENDER ──────────────────────────────────────────────────────
  async handleAskGender(session, message) {
    const gender = message.trim().toLowerCase();
    if (['male', 'female'].includes(gender)) {
      session.petData.gender = gender;
      session.currentStep = 'ask_city';
      await session.save();
      return this.getStepMessage('ask_city');
    }
    
    // Try to extract from variations
    if (['m', 'boy', 'he', 'him'].includes(gender)) {
      session.petData.gender = 'male';
      session.currentStep = 'ask_city';
      await session.save();
      return this.getStepMessage('ask_city');
    }
    if (['f', 'girl', 'she', 'her'].includes(gender)) {
      session.petData.gender = 'female';
      session.currentStep = 'ask_city';
      await session.save();
      return this.getStepMessage('ask_city');
    }
    
    return `Please enter *Male* or *Female*.\n\n(Type "male" or "female")`;
  }

  // ─── HANDLE CITY ─────────────────────────────────────────────────────────
  async handleAskCity(session, message) {
    const city = message.trim();
    const matchedCity = CITY_OPTIONS.find(c => c.toLowerCase() === city.toLowerCase());
    
    if (!matchedCity) {
      return `Please select a valid city from the list:
${CITY_OPTIONS.map(c => `• ${c}`).join('\n')}

Please type your city name.`;
    }
    
    session.userData.city = matchedCity;
    session.currentStep = DOC_STEPS[0].step;
    await session.save();
    
    return this.getStepMessage('ask_document_anti_rabies', { 
      city: matchedCity,
      totalDocs: this.getTotalDocsForCity(matchedCity)
    });
  }

  // ─── HANDLE DOCUMENT REQUEST ────────────────────────────────────────────
  async handleDocumentRequest(session, message) {
    // If user says "skip" for optional documents
    if (message.toLowerCase() === 'skip') {
      // Check if current doc is optional (vaccinationCard for Ghaziabad/Noida)
      const currentDoc = DOC_STEPS.find(d => d.step === session.currentStep);
      if (currentDoc?.key === 'vaccinationCard' && 
          ['Ghaziabad', 'Noida'].includes(session.userData?.city)) {
        return await this.moveToNextDocument(session);
      }
      return `📄 ${currentDoc?.label} is required. Please upload this document.`;
    }

    // User is trying to send a document
    // This is handled via media upload, but we can also check for text
    if (message.toLowerCase().includes('upload') || message.toLowerCase().includes('file')) {
      return `📤 Please use the *attachment* feature in WhatsApp to upload your document.

You can upload:
• PDF files
• Images (JPG, PNG)

Click the 📎 icon and select your file.`;
    }

    // Default: show document instructions
    const currentDoc = DOC_STEPS.find(d => d.step === session.currentStep);
    return `📄 Please upload your *${currentDoc?.label}*.

You can upload:
• PDF files
• Images (JPG, PNG)

Click the 📎 icon and select your file.

${this.getOptionalHint(currentDoc?.key, session.userData?.city)}`;
  }

  // ─── HANDLE DOCUMENT UPLOAD ─────────────────────────────────────────────
  async handleDocumentUpload(session, message, mediaUrl) {
    const currentDoc = DOC_STEPS.find(d => d.step === session.currentStep);
    
    if (!currentDoc) {
      return `I'm not sure what document this is for. Please type your message again.`;
    }

    // Store document (mediaUrl is the URL or base64 from Wapp.biz)
    session.documents[currentDoc.key] = {
      fileData: mediaUrl,
      fileName: `${currentDoc.key}_${Date.now()}.jpg`,
      fileSize: 0,
      mimeType: 'image/jpeg',
      uploadedAt: new Date()
    };
    
    await session.save();

    // Move to next document
    return await this.moveToNextDocument(session);
  }

  // ─── MOVE TO NEXT DOCUMENT ──────────────────────────────────────────────
  async moveToNextDocument(session) {
    const currentIndex = DOC_STEPS.findIndex(d => d.step === session.currentStep);
    const nextIndex = currentIndex + 1;
    
    // If this was the last document
    if (nextIndex >= DOC_STEPS.length) {
      session.currentStep = 'ask_payment';
      await session.save();
      return this.getStepMessage('ask_payment', {
        amount: this.getAmountForCity(session.userData?.city),
        petName: session.petData.name
      });
    }

    // Check if next document is optional
    const nextDoc = DOC_STEPS[nextIndex];
    const isOptional = nextDoc.key === 'vaccinationCard' && 
                       ['Ghaziabad', 'Noida'].includes(session.userData?.city);

    session.currentStep = nextDoc.step;
    await session.save();

    let message = `📄 *Document ${nextIndex + 1}/${this.getTotalDocsForCity(session.userData?.city)}: ${nextDoc.label}*

Please upload this document.`;
    
    if (isOptional) {
      message += `\n\n💡 This document is *optional* for ${session.userData?.city}. Type "skip" to skip it.`;
    }

    return message;
  }

  // ─── HANDLE PAYMENT ──────────────────────────────────────────────────────
  async handlePayment(session, message) {
    // Check if user indicates payment is done
    if (message.toLowerCase().includes('paid') || 
        message.toLowerCase().includes('done') || 
        message.toLowerCase().includes('complete')) {
      
      // Create user account
      const user = await this.createUserAccount(session);
      const pet = await this.createPet(session, user);
      await this.createRegistrationForm(session, pet);
      
      session.isComplete = true;
      session.isConverted = true;
      session.userId = user._id;
      session.petId = pet._id;
      session.completedAt = new Date();
      session.currentStep = 'complete';
      await session.save();

      return this.getStepMessage('complete', {
        petName: pet.name,
        phoneNumber: session.phoneNumber
      });
    }

    // If user types "help" for payment instructions
    if (message.toLowerCase().includes('help')) {
      return this.getStepMessage('ask_payment', {
        amount: this.getAmountForCity(session.userData?.city),
        petName: session.petData.name
      });
    }

    // Default: Show payment instructions again
    return this.getStepMessage('ask_payment', {
      amount: this.getAmountForCity(session.userData?.city),
      petName: session.petData.name
    });
  }

  // ─── CREATE USER ACCOUNT ────────────────────────────────────────────────
  async createUserAccount(session) {
    // Check if user already exists
    let user = await User.findOne({ whatsappNumber: session.phoneNumber });
    
    if (user) {
      return user;
    }
    
    // Create new user
    const cityMap = {
      'Delhi': 'delhi',
      'Noida': 'noida',
      'Ghaziabad': 'ghaziabad',
      'Gurgaon': 'gurgaon',
      'Faridabad': 'faridabad'
    };
    
    user = new User({
      whatsappNumber: session.phoneNumber,
      name: session.userData.name || 'Bot User',
      username: `bot_${session.phoneNumber.slice(-6)}`,
      isVerified: true,
      city: cityMap[session.userData?.city] || 'ghaziabad',
      role: 'user',
      lastLoginAt: new Date(),
      isBotCreated: true,
      botSessionId: session._id
    });
    
    await user.save();
    console.log(`✅ Bot user created: ${user.whatsappNumber}`);
    return user;
  }

  // ─── CREATE PET ──────────────────────────────────────────────────────────
  async createPet(session, user) {
    const cityMap = {
      'Delhi': 'delhi',
      'Noida': 'noida',
      'Ghaziabad': 'ghaziabad',
      'Gurgaon': 'gurgaon',
      'Faridabad': 'faridabad'
    };
    
    const pet = new Pet({
      name: session.petData.name || 'Unknown',
      species: 'dog',
      ageYears: session.petData.ageYears || 0,
      ageMonths: session.petData.ageMonths || 0,
      breed: session.petData.breed || 'Mixed',
      gender: session.petData.gender || 'unknown',
      city: cityMap[session.userData?.city] || 'ghaziabad',
      owner: user._id,
      registrationStatus: 'documents_uploaded',
      registrationStage: 1,
      isBotCreated: true,
      botSessionId: session._id,
      // Add documents from session
      antiRabiesCertificate: session.documents.antiRabiesCertificate || {},
      idProof: session.documents.idProof || {},
      residenceProof: session.documents.residenceProof || {},
      ownerWithPetPhoto: session.documents.ownerWithPetPhoto || {},
      petPhoto: session.documents.petPhoto || {},
      vaccinationCard: session.documents.vaccinationCard || {},
    });
    
    await pet.save();
    console.log(`✅ Bot pet created: ${pet.name} for ${user.whatsappNumber}`);
    return pet;
  }

  // ─── CREATE REGISTRATION FORM ───────────────────────────────────────────
  async createRegistrationForm(session, pet) {
    const docs = [];
    const docMap = {
      antiRabiesCertificate: 'antiRabiesCertificate',
      idProof: 'idProof',
      residenceProof: 'residenceProof',
      ownerWithPetPhoto: 'ownerWithPetPhoto',
      petPhoto: 'petPhoto',
      vaccinationCard: 'vaccinationCard'
    };
    
    for (const [key, value] of Object.entries(docMap)) {
      if (session.documents[key]?.fileData) {
        docs.push({
          documentName: key,
          fileData: session.documents[key].fileData,
          fileName: session.documents[key].fileName || `${key}.pdf`,
          fileSize: session.documents[key].fileSize || 0,
          mimeType: session.documents[key].mimeType || 'application/pdf',
          uploadedAt: session.documents[key].uploadedAt || new Date()
        });
      }
    }
    
    const form = new RegistrationForm({
      pet: pet._id,
      documents: docs,
      registrationTriggered: true,
      registrationTriggeredAt: new Date(),
      isComplete: true,
      paymentStatus: 'completed',
      paymentAmount: this.getAmountForCity(session.userData?.city),
    });
    
    await form.save();
    console.log(`✅ Bot registration form created for ${pet.name}`);
    return form;
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────

  getStepMessage(step, data = {}) {
    const messages = {
      'welcome': `🐾 *Welcome to Tailio!* 

I'm your pet registration assistant. 🐶

I'll help you register your pet in just a few minutes. 

Type *"start"* or *"register"* to begin!`,

      'ask_name': `Great! 👋

What's your *full name*?`,

      'ask_pet_name': `Nice to meet you, *${data.name || 'Pet Parent'}*! 🎉

Now, what's your *pet's name*?`,

      'ask_pet_age': `What a lovely name, *${data.petName || 'your pet'}*! ❤️

How old is your pet? (e.g., "3 years 6 months" or just "2")`,

      'ask_pet_breed': `Got it! ${data.age || ''} 🐶

What *breed* is your pet? (e.g., Labrador, Poodle, Mixed, etc.)`,

      'ask_gender': `Great!

What's your pet's *gender*?
Type *Male* or *Female*`,

      'ask_city': `Perfect! 🎉

Which city are you registering in?
${CITY_OPTIONS.map(c => `• *${c}*`).join('\n')}

Please type your city name.`,

      'ask_document_anti_rabies': `Great! Registering in *${data.city || ''}*. 📍

Now, I need some documents. Please upload them one by one.

📄 *Document 1/${data.totalDocs || 6}: Anti-Rabies Certificate*
Please upload your pet's anti-rabies vaccination certificate.

You can upload:
• PDF files
• Images (JPG, PNG)

Click the 📎 icon and select your file.`,

      'ask_payment': `💰 *Payment Required*

All documents collected! 🎉

To complete your registration, please pay the registration fee:
*Amount: ₹${data.amount || 999}* (inclusive of all taxes)

After payment, type *"paid"* or *"done"*.

*Payment link:* ${process.env.FRONTEND_URL || 'https://tailio.com'}/payment/bot`,

      'complete': `🎉 *Registration Complete!*

Your pet *${data.petName || 'your pet'}* is now officially registered! 🐾

📋 What's Next:
• We'll file with your municipal authority within 24 hours
• You'll receive an OTP from the municipal corporation
• Your certificate will be ready in 5-7 working days

You can log in to your account using your phone number: *${data.phoneNumber || session.phoneNumber}*

Thank you for choosing Tailio! 💚`
    };

    return messages[step] || 'I\'m here to help! Type "start" to begin.';
  }

  getTotalDocsForCity(city) {
    const isGhaziabadNoida = ['Ghaziabad', 'Noida'].includes(city);
    const isGurgaon = city === 'Gurgaon';
    const isFaridabad = city === 'Faridabad';
    
    if (isFaridabad) return 6;
    if (isGurgaon) return 7;
    if (isGhaziabadNoida) return 7;
    return 6;
  }

  getAmountForCity(city) {
    const cityMap = {
      'Ghaziabad': 1500,
      'Gurgaon': 1500,
      'Delhi': 799,
      'Noida': 799,
      'Faridabad': 1799
    };
    return cityMap[city] || 999;
  }

  getOptionalHint(docKey, city) {
    if (docKey === 'vaccinationCard' && ['Ghaziabad', 'Noida'].includes(city)) {
      return `\n💡 *Optional*: This document is optional for ${city}. Type "skip" to skip it.`;
    }
    return '';
  }

  getDefaultResponse(session) {
    return `👋 I'm here to help you register your pet!

Current step: ${session.currentStep?.replace('_', ' ') || 'welcome'}

Type "help" if you need assistance.`;
  }

  // ─── ADMIN HELPERS ──────────────────────────────────────────────────────

  async getAdminStats() {
    const total = await BotSession.countDocuments();
    const converted = await BotSession.countDocuments({ isConverted: true });
    const inProgress = await BotSession.countDocuments({ 
      isComplete: false, 
      isConverted: false,
      currentStep: { $nin: ['welcome', 'abandoned'] }
    });
    const abandoned = await BotSession.countDocuments({ 
      currentStep: 'abandoned' 
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySessions = await BotSession.countDocuments({ 
      startedAt: { $gte: today } 
    });

    return {
      total,
      converted,
      conversionRate: total > 0 ? ((converted / total) * 100).toFixed(1) : '0',
      inProgress,
      abandoned,
      todaySessions
    };
  }

  async getBotUsers(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    
    const [total, sessions] = await Promise.all([
      BotSession.countDocuments(),
      BotSession.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    // Get user and pet info for each session
    const sessionsWithDetails = await Promise.all(sessions.map(async (session) => {
      const user = await User.findOne({ whatsappNumber: session.phoneNumber });
      const pet = await Pet.findOne({ botSessionId: session._id });
      
      return {
        ...session,
        user: user ? {
          _id: user._id,
          name: user.name,
          email: user.email,
          isVerified: user.isVerified
        } : null,
        pet: pet ? {
          _id: pet._id,
          name: pet.name,
          registrationStage: pet.registrationStage
        } : null,
        documentCount: session.documents ? 
          Object.keys(session.documents).filter(k => session.documents[k]?.fileData).length : 0
      };
    }));

    return {
      sessions: sessionsWithDetails,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }
}

module.exports = new BotService();