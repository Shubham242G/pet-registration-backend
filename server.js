// server.js
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
  'https://tailio.in',
  // ✅ ADD YOUR RENDER.COM DOMAIN
  'https://pet-registration-backend-t3d9.onrender.com'
];

// ✅ IMPROVED CORS MIDDLEWARE
app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log(`🔍 CORS Check - Origin: ${origin}`);
  console.log(`🔍 Request: ${req.method} ${req.path}`);
  
  // ✅ Determine if origin is allowed
  let isAllowed = false;
  
  if (!origin) {
    isAllowed = true;
    console.log('🔍 No origin, allowing request (server-to-server)');
  } else if (allowedOrigins.includes(origin)) {
    isAllowed = true;
    console.log(`✅ Origin ${origin} is in allowed list`);
  } else if (origin && origin.match(/https:\/\/.*\.vercel\.app$/)) {
    isAllowed = true;
    console.log(`✅ Origin ${origin} is a vercel.app subdomain`);
  } else if (origin && origin.match(/^http:\/\/localhost:\d+$/)) {
    isAllowed = true;
    console.log(`✅ Origin ${origin} is localhost`);
  } else if (origin && origin.match(/^http:\/\/127\.0\.0\.1:\d+$/)) {
    isAllowed = true;
    console.log(`✅ Origin ${origin} is 127.0.0.1`);
  } else if (origin && origin.match(/https:\/\/.*\.onrender\.com$/)) {
    // ✅ ADD RENDER.COM SUBDOMAINS
    isAllowed = true;
    console.log(`✅ Origin ${origin} is a render.com subdomain`);
  } else {
    console.log(`❌ CORS blocked origin: ${origin}`);
  }
  
  // ✅ Set CORS headers for all responses (not just OPTIONS)
  if (isAllowed) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
  } else if (origin) {
    // ✅ For blocked origins, still allow OPTIONS but block actual requests
    if (req.method === 'OPTIONS') {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Max-Age', '86400');
      return res.status(200).end();
    }
    return res.status(403).json({ 
      error: 'CORS origin not allowed',
      origin: origin 
    });
  }
  
  // ✅ Handle OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling OPTIONS preflight request');
    return res.status(200).end();
  }
  
  next();
});

// ✅ Alternative: Use the cors package as a fallback
// Uncomment if the custom middleware doesn't work
/*
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    if (origin.match(/https:\/\/.*\.vercel\.app$/)) {
      return callback(null, true);
    }
    if (origin.match(/https:\/\/.*\.onrender\.com$/)) {
      return callback(null, true);
    }
    if (origin.match(/^http:\/\/localhost:\d+$/)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  maxAge: 86400
}));
*/

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files statically
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// Log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Database connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Error:', err));

process.on('unhandledRejection', (err) => {
  console.error('💥 Unhandled Rejection:', err);
  console.error('Stack:', err.stack);
});

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  console.error('Stack:', err.stack);
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pets', require('./routes/pets'));
app.use('/api/registration', require('./routes/registrationForms'));
app.use('/api/admin', require('./routes/admin/admin'));
app.use('/api/whatsapp-auth', require('./routes/whatsappAuth'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/blog', require('./routes/blog'));
// app.use('/api/bot', require('./routes/bot'));

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
  console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err.stack);
  res.status(500).json({ 
    message: 'Server error', 
    error: process.env.NODE_ENV === 'development' ? err.message : {} 
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Uploads directory: ${path.join(__dirname, 'uploads')}`);
  console.log('✅ Razorpay initialized successfully');
});