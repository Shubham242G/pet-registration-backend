const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();




// Security & Performance middleware
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (
        origin.includes("vercel.app") ||
        origin === "http://localhost:3000"
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
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
app.use('/api/registration-forms', require('./routes/registrationForms'),
require('./routes/registrationForms'));


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
