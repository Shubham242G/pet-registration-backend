const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    console.log('Register attempt - Body:', req.body);
    const { email, password, username, name } = req.body;
    
    // Use username from frontend, fallback to name
    const userName = username || name;
    
    if (!userName) {
      return res.status(400).json({ message: 'Username is required' });
    }
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }
    
    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    
    // Check if username already exists
    const existingUsername = await User.findOne({ username: userName });
    if (existingUsername) {
      return res.status(400).json({ message: 'Username already taken' });
    }
    
    // Create user with both username and name fields
    const user = new User({ 
      email, 
      password, 
      username: userName,
      name: userName
    });
    await user.save();
    
    console.log('User created successfully:', user._id);
    
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        email, 
        username: userName,
        name: userName,
        role: user.role 
      } 
    });
  } catch (error) {
    console.error('Register error details:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/verify', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ valid: false, message: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ valid: false, message: 'User not found' });
    }
    
    res.json({ 
      valid: true, 
      user: {
        id: user._id,
        email: user.email,
        username: user.username || user.name,
        name: user.name || user.username,
        role: user.role
      }
    });
  } catch (error) {
    res.status(401).json({ valid: false, message: 'Token invalid or expired' });
  }
});

router.post('/login', async (req, res) => {
  try {
    console.log('Login attempt:', req.body.email);
    const { email, password } = req.body;
    
    // Allow login with email OR username
    const user = await User.findOne({ 
      $or: [{ email: email }, { username: email }] 
    });
    
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        email: user.email, 
        username: user.username,
        name: user.name || user.username,
        role: user.role 
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;