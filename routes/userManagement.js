const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Device = require('../models/Device');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

// Get all users (Admin only)
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const users = await User.find({ role: 'user' }).select('-password');
    
    const usersWithDevices = await Promise.all(
      users.map(async (user) => {
        const deviceCount = await Device.countDocuments({ userId: user._id });
        return { ...user.toJSON(), deviceCount };
      })
    );

    res.json({ success: true, users: usersWithDevices });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Register new user (Admin only)
router.post('/register', auth, [
  body('username').notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('name').notEmpty()
], async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admin can register users' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { username, email, password, name, mobile } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({
      username, email, password: hashedPassword, name, mobile, role: 'user'
    });

    await user.save();
    const userResponse = user.toJSON();
    delete userResponse.password;

    res.status(201).json({ success: true, message: 'User registered', user: userResponse });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update user (Admin only)
router.put('/:userId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { userId } = req.params;
    const { username, email, name, mobile, password } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (username) user.username = username;
    if (email) user.email = email;
    if (name) user.name = name;
    if (mobile) user.mobile = mobile;
    if (password) user.password = await bcrypt.hash(password, 12);

    await user.save();
    const userResponse = user.toJSON();
    delete userResponse.password;

    res.json({ success: true, message: 'User updated', user: userResponse });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete user (Admin only)
router.delete('/:userId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { userId } = req.params;
    
    // Unassign all devices from user
    await Device.updateMany({ userId }, { userId: null });
    
    // Delete user
    await User.findByIdAndDelete(userId);

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;