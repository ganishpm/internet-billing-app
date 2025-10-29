const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { ensureAuth, ensureGuest } = require('../middleware/auth');

// Login Page
router.get('/login', ensureGuest, (req, res) => {
    res.render('auth/login', {
        title: 'Login',
        error: null
    });
});

// Login Process
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Find user
        const user = await User.findOne({ username });
        if (!user) {
            return res.render('auth/login', {
                title: 'Login',
                error: 'Username atau password salah'
            });
        }
        
        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('auth/login', {
                title: 'Login',
                error: 'Username atau password salah'
            });
        }
        
        // Set session
        req.session.user = {
            id: user._id,
            username: user.username,
            role: user.role
        };
        
        res.redirect('/dashboard');
    } catch (error) {
        console.log(error);
        res.render('auth/login', {
            title: 'Login',
            error: 'Terjadi kesalahan'
        });
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

module.exports = router;
