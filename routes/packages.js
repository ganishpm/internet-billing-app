const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middleware/auth');
const Package = require('../models/Package');
const { body, validationResult } = require('express-validator');

// Get all packages
router.get('/', ensureAuth, async (req, res) => {
    try {
        const packages = await Package.find().sort({ createdAt: -1 });
        res.render('packages/index', {
            title: 'Paket Internet',
            packages,
            user: req.session.user
        });
    } catch (error) {
        console.log(error);
        res.render('packages/index', {
            title: 'Paket Internet',
            packages: [],
            user: req.session.user
        });
    }
});

// Add package form
router.get('/add', ensureAuth, (req, res) => {
    res.render('packages/add', {
        title: 'Tambah Paket',
        user: req.session.user,
        errors: [],
        data: {}
    });
});

// Add package process
router.post('/add', ensureAuth, [
    body('name').notEmpty().withMessage('Nama paket wajib diisi'),
    body('speed').notEmpty().withMessage('Kecepatan wajib diisi'),
    body('price').isNumeric().withMessage('Harga harus berupa angka')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            return res.render('packages/add', {
                title: 'Tambah Paket',
                user: req.session.user,
                errors: errors.array(),
                data: req.body
            });
        }
        
        const package = new Package(req.body);
        await package.save();
        
        req.flash('success_msg', 'Paket berhasil ditambahkan');
        res.redirect('/packages');
    } catch (error) {
        console.log(error);
        res.render('packages/add', {
            title: 'Tambah Paket',
            user: req.session.user,
            errors: [{ msg: 'Terjadi kesalahan' }],
            data: req.body
        });
    }
});

// Toggle package status
router.put('/toggle/:id', ensureAuth, async (req, res) => {
    try {
        const package = await Package.findById(req.params.id);
        package.isActive = !package.isActive;
        await package.save();
        
        res.json({ success: true, isActive: package.isActive });
    } catch (error) {
        console.log(error);
        res.json({ success: false });
    }
});

// Edit package form
router.get('/edit/:id', ensureAuth, async (req, res) => {
    try {
        const pkg = await Package.findById(req.params.id);
        
        if (!pkg) {
            req.flash('error_msg', 'Paket tidak ditemukan');
            return res.redirect('/packages');
        }
        
        res.render('packages/edit', {
            title: 'Edit Paket',
            package: pkg,
            user: req.session.user,
            errors: []
        });
    } catch (error) {
        console.log(error);
        req.flash('error_msg', 'Terjadi kesalahan');
        res.redirect('/packages');
    }
});

// Update package process
router.put('/edit/:id', ensureAuth, [
    body('name').notEmpty().withMessage('Nama paket wajib diisi'),
    body('speed').notEmpty().withMessage('Kecepatan wajib diisi'),
    body('price').isNumeric().withMessage('Harga harus berupa angka')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            const pkg = await Package.findById(req.params.id);
            return res.render('packages/edit', {
                title: 'Edit Paket',
                package: pkg,
                user: req.session.user,
                errors: errors.array()
            });
        }
        
        await Package.findByIdAndUpdate(req.params.id, req.body);
        req.flash('success_msg', 'Paket berhasil diperbarui');
        res.redirect('/packages');
    } catch (error) {
        console.log(error);
        req.flash('error_msg', 'Terjadi kesalahan');
        res.redirect('/packages');
    }
});

// Delete package
router.delete('/:id', ensureAuth, async (req, res) => {
    try {
        await Package.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Paket berhasil dihapus');
        res.redirect('/packages');
    } catch (error) {
        console.log(error);
        req.flash('error_msg', 'Gagal menghapus paket. Mungkin sedang digunakan oleh pelanggan.');
        res.redirect('/packages');
    }
});


module.exports = router;
