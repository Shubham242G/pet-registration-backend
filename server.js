const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Security & Performance middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173',
  'https://tailio-admin-frontend.vercel.app',
  'https://pet-registration.vercel.app',
  'https://pet-registration-git-main.vercel.app',
  'https://www.tailio.in',
  'https://tailio.in'
];

// CORS middleware with detailed logging
app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log(`🔍 CORS Check - Origin: ${origin}`);
  console.log(`🔍 Request: ${req.method} ${req.path}`);
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('🔍 Handling OPTIONS preflight request');
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }
  
  // Check if origin is allowed
  let isAllowed = false;
  
  if (!origin) {
    isAllowed = true;
    console.log('🔍 No origin, allowing request');
  } else if (allowedOrigins.includes(origin)) {
    isAllowed = true;
    console.log(`🔍 Origin ${origin} is in allowed list`);
  } else if (origin.match(/https:\/\/.*\.vercel\.app$/)) {
    isAllowed = true;
    console.log(`🔍 Origin ${origin} is a vercel.app subdomain`);
  } else if (origin.match(/^http:\/\/localhost:\d+$/)) {
    isAllowed = true;
    console.log(`🔍 Origin ${origin} is localhost`);
  } else if (origin.match(/^http:\/\/127\.0\.0\.1:\d+$/)) {
    isAllowed = true;
    console.log(`🔍 Origin ${origin} is 127.0.0.1`);
  } else {
    console.log(`❌ CORS blocked origin: ${origin}`);
  }
  
  if (isAllowed) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
  } else {
    return res.status(403).json({ 
      error: 'CORS origin not allowed',
      origin: origin 
    });
  }
  
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files statically
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// Log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Database
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pets', require('./routes/pets'));
app.use('/api/registration', require('./routes/registrationForms'));
app.use('/api/admin', require('./routes/admin/admin'));
app.use('/api/whatsapp-auth', require('./routes/whatsappAuth'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/blog', require('./routes/blog'));

// Test endpoint to verify CORS is working
app.get('/api/test-cors', (req, res) => {
  res.json({ 
    message: 'CORS is working!',
    origin: req.headers.origin,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).json({ message: 'Server error', error: process.env.NODE_ENV === 'development' ? err.message : {} });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Uploads directory: ${path.join(__dirname, 'uploads')}`);
});

console.log('✅ Razorpay initialized successfully');