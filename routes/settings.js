const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const axios = require('axios');
const { ensureAuth } = require('../middleware/auth');
const { ensureAdmin } = require('../middleware/admin');
const User = require('../models/User');
const Setting = require('../models/Setting');
const { body, validationResult } = require('express-validator');
const messageService = require('../services/messageService');

// Helper untuk mendapatkan atau membuat setting pertama kali
const getSettings = async () => {
    let settings = await Setting.findOne();
    if (!settings) {
        settings = await Setting.create({});
    }
    return settings;
};

// ===================================================================
// I N D E K
// ===================================================================
router.get('/', ensureAuth, async (req, res) => {
    const settings = await getSettings();
    res.render('settings/index', { title: 'Pengaturan', user: req.session.user, settings });
});

// ===================================================================
// P R O F I L
// ===================================================================
router.get('/profile', ensureAuth, (req, res) => {
    res.render('settings/profile', { title: 'Pengaturan Profil', user: req.session.user, errors: [] });
});

router.post('/profile', ensureAuth, [
    body('name').notEmpty().withMessage('Nama tidak boleh kosong'),
    body('newPassword').custom((value, { req }) => {
        if (value && value.length < 6) {
            throw new Error('Password baru minimal 6 karakter');
        }
        return true;
    })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('settings/profile', { title: 'Pengaturan Profil', user: req.session.user, errors: errors.array() });
        }
        const { name, currentPassword, newPassword } = req.body;
        const user = await User.findById(req.session.user.id);
        user.name = name;
        if (newPassword) {
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) { req.flash('error_msg', 'Password saat ini salah'); return res.redirect('/settings/profile'); }
            user.password = await bcrypt.hash(newPassword, 10);
        }
        await user.save();
        req.flash('success_msg', 'Profil berhasil diperbarui');
        res.redirect('/settings/profile');
    } catch (err) { console.error(err); req.flash('error_msg', 'Terjadi kesalahan'); res.redirect('/settings/profile'); }
});

// ===================================================================
// M A N A J E M E N  U S E R  (A d m i n  O n l y)
// ===================================================================
router.get('/users', ensureAuth, ensureAdmin, async (req, res) => {
    const users = await User.find().select('-password');
    res.render('settings/users', { title: 'Manajemen User', user: req.session.user, users, errors: [] });
});

router.post('/users/add', ensureAuth, ensureAdmin, [
    body('username').notEmpty().withMessage('Username wajib diisi'),
    body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter'),
    body('role').isIn(['admin', 'staff']).withMessage('Role tidak valid')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        const users = await User.find().select('-password');
        if (!errors.isEmpty()) {
            return res.render('settings/users', { title: 'Manajemen User', user: req.session.user, users, errors: errors.array() });
        }
        const { username, password, role } = req.body;
        const existingUser = await User.findOne({ username });
        if (existingUser) { req.flash('error_msg', 'Username sudah ada'); return res.redirect('/settings/users'); }
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ username, password: hashedPassword, role });
        req.flash('success_msg', 'User berhasil ditambahkan');
        res.redirect('/settings/users');
    } catch (err) { console.error(err); req.flash('error_msg', 'Terjadi kesalahan'); res.redirect('/settings/users'); }
});

router.delete('/users/:id', ensureAuth, ensureAdmin, async (req, res) => {
    if (req.params.id === req.session.user.id) { req.flash('error_msg', 'Tidak bisa menghapus user yang sedang login'); return res.redirect('/settings/users'); }
    await User.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'User berhasil dihapus');
    res.redirect('/settings/users');
});

// ===================================================================
// P E N G A T U R A N  S I S T E M  (A d m i n  O n l y)
// ===================================================================
router.get('/system', ensureAuth, ensureAdmin, async (req, res) => {
    const settings = await getSettings();
    res.render('settings/system', { title: 'Pengaturan Sistem', user: req.session.user, settings, errors: [] });
});

router.post('/system', ensureAuth, ensureAdmin, [
    body('providerName').notEmpty().withMessage('Nama Provider wajib diisi'),
    body('defaultInvoiceDay').isInt({ min: 1, max: 31 }).withMessage('Tanggal harus antara 1-31'),
    body('pppoeDisableGraceDays').isInt({ min: 0 }).withMessage('Hari harus angka positif')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const settings = await Setting.findOne();
            return res.render('settings/system', { title: 'Pengaturan Sistem', settings, user: req.session.user, errors: errors.array() });
        }
        const { providerName, defaultInvoiceDay, pppoeDisableGraceDays } = req.body;
        await Setting.findOneAndUpdate({}, { providerName, defaultInvoiceDay, pppoeDisableGraceDays }, { upsert: true, new: true });
        req.flash('success_msg', 'Pengaturan sistem berhasil diperbarui');
        res.redirect('/settings/system');
    } catch (error) { console.error(error); req.flash('error_msg', 'Terjadi kesalahan'); res.redirect('/settings/system'); }
});

// ===================================================================
// T E M P L A T E  P E S A N  (A d m i n  O n l y)
// ===================================================================
router.get('/templates', ensureAuth, ensureAdmin, async (req, res) => {
    const settings = await getSettings();
    res.render('settings/templates', { title: 'Template Pesan', user: req.session.user, settings, errors: [] });
});

router.post('/templates', ensureAuth, ensureAdmin, async (req, res) => {
    try {
        const { waTemplate, paymentConfirmationTemplate, invoiceGenerationTemplate } = req.body;
        await Setting.findOneAndUpdate({}, { waTemplate, paymentConfirmationTemplate, invoiceGenerationTemplate }, { upsert: true, new: true });
        req.flash('success_msg', 'Semua template pesan berhasil diperbarui');
        res.redirect('/settings/templates');
    } catch (error) { console.error(error); req.flash('error_msg', 'Terjadi kesalahan'); res.redirect('/settings/templates'); }
});

// ===================================================================
// I N T E G R A S I  A P I  (A d m i n  O n l y)
// ===================================================================
router.get('/integrations', ensureAuth, ensureAdmin, async (req, res) => {
    const settings = await getSettings();
    res.render('settings/integrations', { title: 'Integrasi API', user: req.session.user, settings });
});

router.post('/integrations', ensureAuth, ensureAdmin, async (req, res) => {
    try {
        await Setting.findOneAndUpdate({}, req.body, { upsert: true, new: true });
        req.flash('success_msg', 'Pengaturan integrasi berhasil diperbarui');
        res.redirect('/settings/integrations');
    } catch (err) { console.error(err); req.flash('error_msg', 'Terjadi kesalahan'); res.redirect('/settings/integrations'); }
});



/**
 * @route   POST /settings/test-whatsapp
 * @desc    Menjalankan test koneksi ke WaBlas, Kirimi.ID, atau WeaGate
 * @access  Private (Admin)
 */
router.post('/test-whatsapp', ensureAuth, ensureAdmin, async (req, res) => {
    const { provider, ...data } = req.body;

    try {
        if (provider === 'wablas') {
            const { apiUrl, apiKey } = data;
            if (!apiUrl || !apiKey) {
                return res.status(400).json({ success: false, message: 'API URL dan API Key wajib diisi.' });
            }
            const response = await axios.get(`${apiUrl}/api/device/info?token=${apiKey}`);
            res.json({ success: true, message: 'Koneksi ke WaBlas berhasil! Perangkat terhubung.' });

        } else if (provider === 'kirimi') {
            // PERBAIKAN: Gunakan endpoint /v1/user-info untuk test koneksi
            const { userCode, secretKey } = data;
            if (!userCode || !secretKey) {
                return res.status(400).json({ success: false, message: 'User Code dan Secret Key wajib diisi untuk test koneksi.' });
            }

            const response = await axios.post('https://api.kirimi.id/v1/user-info', {
                user_code: userCode,
                secret: secretKey
            });

            // Asumsikan response sukses akan memiliki status 'success' atau data user
            if (response.data.status === 'success' || response.data.data) {
                res.json({ success: true, message: 'Koneksi ke Kirimi.ID berhasil! User valid.' });
            } else {
                // Jika API mengembalikan error, tampilkan pesan dari API
                res.json({ success: false, message: `Koneksi gagal: ${response.data.message || 'User Code atau Secret Key tidak valid.'}` });
            }

        } else if (provider === 'weagate') { // <-- TAMBAHKAN BLOK INI
            const { token } = data;
            // Panggil fungsi test dari messageService yang telah kita buat
            const result = await messageService.testWeagateConnection(token);
            return res.json(result);

        } else {
            res.json({ success: false, message: 'Provider tidak valid.' });
        }
    } catch (error) {
        console.error('[Test WhatsApp Error]', error.response ? error.response.data : error.message);

        // Tangani error spesifik dari Kirimi.ID
        if (error.response && error.response.status === 401) {
            res.status(401).json({ success: false, message: 'Koneksi gagal: User Code atau Secret Key tidak valid.' });
        } else {
            // Error umum untuk provider lain atau masalah jaringan
            res.status(500).json({ success: false, message: 'Gagal menguji koneksi. Periksa kembali data Anda.' });
        }
    }
});
module.exports = router;
