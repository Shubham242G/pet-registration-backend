const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return res.status(401).json({ message: 'User not found' });
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Role-based access
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

// Admin or salesman with permission
const requirePermission = (customerId) => {
  return async (req, res, next) => {
    if (req.user.role === 'admin') return next();
    
    if (req.user.role !== 'salesman') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Check if salesman created this customer OR has permission
    const Permission = require('../models/Permission');
    const permission = await Permission.findOne({
      salesman: req.user._id,
      customer: customerId,
      permission: { $in: ['view', 'edit'] }
    });
    
    if (!permission) {
      return res.status(403).json({ message: 'No permission for this customer' });
    }
    
    req.permission = permission.permission;
    next();
  };
};

module.exports = { auth, requireRole, requirePermission };
