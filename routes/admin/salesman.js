const express = require('express');
const User = require('../../models/User');
const Permission = require('../../models/Permission');
const router = express.Router();

// GET /api/admin/salesmen - List all salesmen
router.get('/salesmen', async (req, res) => {
  try {
    const salesmen = await User.find({ role: 'salesman', isDeleted: false })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(salesmen);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/salesmen - Create salesman
router.post('/salesmen', async (req, res) => {
  try {
    const { name, email, password, mobile, customerPermissions } = req.body;
    
    const salesman = new User({
      name,
      email,
      password,
      mobile,
      role: 'salesman'
    });
    
    await salesman.save();
    
    // Assign customer permissions if provided
    if (customerPermissions) {
      for (const custId of customerPermissions) {
        await Permission.create({
          salesman: salesman._id,
          customer: custId,
          permission: 'view' // default
        });
      }
    }
    
    res.status(201).json(salesman);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
