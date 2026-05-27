// const express = require('express');
// const mongoose = require('mongoose');
// const cors = require('cors');
// const path = require('path');
// require('dotenv').config();

// const app = express();

// // Security & Performance middleware
// const allowedOrigins = [
//   // Local development
//   'http://localhost:3000',
//   'http://localhost:3001',
//   'http://localhost:3002',
//   'http://localhost:5173',
//   'http://localhost:5174',
//   'http://127.0.0.1:3000',
//   'http://127.0.0.1:3001',
//   'http://127.0.0.1:5173',
//   'https://tailio-admin-frontend.vercel.app',
//   // Production - Vercel (your frontend domains)
//   'https://pet-registration.vercel.app',
//   'https://pet-registration-git-main.vercel.app',
  
//   // Add any custom domains you have
//   // 'https://yourdomain.com',
//   // 'https://www.yourdomain.com',
// ];

// app.use(
//   cors({
//     origin: function (origin, callback) {
//       // Allow requests with no origin (like mobile apps, Postman, server-to-server)
//       if (!origin) {
//         return callback(null, true);
//       }
      
//       // Check if origin is allowed
//       if (allowedOrigins.indexOf(origin) !== -1) {
//         callback(null, true);
//       } 
//       // Also allow any vercel.app subdomain dynamically (for preview deployments)
//       else if (origin.match(/https:\/\/.*\.vercel\.app$/)) {
//         callback(null, true);
//       }
//       // Allow localhost with any port (for development flexibility)
//       else if (origin.match(/^http:\/\/localhost:\d+$/)) {
//         callback(null, true);
//       }
//       // Allow 127.0.0.1 with any port
//       else if (origin.match(/^http:\/\/127\.0\.0\.1:\d+$/)) {
//         callback(null, true);
//       }
//       else {
//         console.log(`CORS blocked origin: ${origin}`);
//         callback(new Error(`Not allowed by CORS: ${origin}`));
//       }
//     },
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
//     allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
//     exposedHeaders: ['Content-Range', 'X-Content-Range'],
//     maxAge: 86400, // 24 hours
//   })
// );
// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// // Serve uploaded files statically
// app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// // Log requests
// app.use((req, res, next) => {
//   console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
//   next();
// });

// // Database
// mongoose.connect(process.env.MONGO_URI)
//   .then(() => console.log('MongoDB Connected Successfully'))
//   .catch(err => console.error('MongoDB Error:', err));

// // Routes - CORRECTED VERSION
// app.use('/api/auth', require('./routes/auth'));
// app.use('/api/pets', require('./routes/pets'));
// app.use('/api/registration', require('./routes/registrationForms')); // Fixed: removed duplicate, changed to /api/registration
// app.use('/api/admin', require('./routes/admin/admin'));

// // 404 handler
// app.use((req, res) => {
//   res.status(404).json({ message: 'Route not found' });
// });

// // Global error handler
// app.use((err, req, res, next) => {
//   console.error('Server Error:', err.stack);
//   res.status(500).json({ message: 'Server error', error: process.env.NODE_ENV === 'development' ? err.message : {} });
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
//   console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
//   console.log(`Uploads directory: ${path.join(__dirname, 'uploads')}`);
// });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
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

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } 
      else if (origin && origin.match(/https:\/\/.*\.vercel\.app$/)) {
        callback(null, true);
      }
      else if (origin && origin.match(/^http:\/\/localhost:\d+$/)) {
        callback(null, true);
      }
      else if (origin && origin.match(/^http:\/\/127\.0\.0\.1:\d+$/)) {
        callback(null, true);
      }
      else {
        console.log(`CORS blocked origin: ${origin}`);
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
});