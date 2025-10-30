const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const Customer = require('../models/Customer');
const Package = require('../models/Package');
const { body, validationResult } = require('express-validator');
const { RouterOSAPI } = require('node-routeros');
const Setting = require('../models/Setting');

// --- AWAL TAMBAHAN BACKUP/RESTORE ---
// Import package baru untuk CSV
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

// Konfigurasi Multer untuk upload file restore
// Pastikan folder 'uploads' ada di root proyek Anda
const upload = multer({ dest: 'uploads/' });
// --- AKHIR TAMBAHAN BACKUP/RESTORE ---


// Helper untuk koneksi ke Mikrotik
async function connectToMikrotik() {
    try {
        const setting = await Setting.findOne();
        if (!setting.mikrotikHost || !setting.mikrotikUser || !setting.mikrotikPass) {
            throw new Error('Konfigurasi Mikrotik tidak lengkap.');
        }
        
        const conn = new RouterOSAPI({
            host: setting.mikrotikHost,
            port: setting.mikrotikPort || '8728',
            user: setting.mikrotikUser,
            password: setting.mikrotikPass,
            timeout: 5000
        });
        
        await conn.connect();
        return conn;
    } catch (error) {
        console.error('Error connecting to Mikrotik:', error);
        throw error;
    }
}

// Get all customers
router.get('/', ensureAuth, async (req, res) => {
    try {
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

        const customers = await Customer.find()
            .populate('package', 'name speed price')
            .sort({ [sortBy]: sortOrder });
        
        res.render('customers/index', {
            title: 'Pelanggan',
            customers,
            user: req.session.user,
            currentSort: { sortBy, order: req.query.sortOrder || 'desc' }
        });
    } catch (error) {
        console.log(error);
        res.render('customers/index', {
            title: 'Pelanggan',
            customers: [],
            user: req.session.user,
            currentSort: { sortBy: 'createdAt', order: 'desc' }
        });
    }
});

// Add customer form
router.get('/add', ensureAuth, async (req, res) => {
    try {
        const packages = await Package.find({ isActive: true });
        res.render('customers/add', {
            title: 'Tambah Pelanggan',
            packages,
            user: req.session.user,
            errors: [],
            data: {}
        });
    } catch (error) {
        console.log(error);
        res.redirect('/customers');
    }
});

// Add customer process
router.post('/add', ensureAuth, [
    body('name').notEmpty().withMessage('Nama wajib diisi'),
    body('email').isEmail().withMessage('Email tidak valid'),
    body('phone').notEmpty().withMessage('Nomor telepon wajib diisi'),
    body('address').notEmpty().withMessage('Alamat wajib diisi'),
    body('package').notEmpty().withMessage('Paket wajib dipilih')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        const packages = await Package.find({ isActive: true });
        
        if (!errors.isEmpty()) {
            return res.render('customers/add', {
                title: 'Tambah Pelanggan',
                packages,
                user: req.session.user,
                errors: errors.array(),
                data: req.body
            });
        }
        
        const customer = new Customer(req.body);
        await customer.save();
        
        // --- LOGIKA TAMBAHAN SECRET PPPOE ---
        if (req.body.pppoeUsername) {
            try {
                const conn = await connectToMikrotik();
                const pkg = await Package.findById(req.body.package);
                
                await conn.write('/ppp/secret/add', [
                    `=name=${req.body.pppoeUsername}`,
                    `=password=${req.body.pppoeUsername}`, // Password sama dengan username
                    `=service=pppoe`//,
                    //`=profile=${pkg.name}` // Asumsikan nama paket sama dengan nama profile Mikrotik
                ]);
                
                await conn.close();
                console.log(`[PPPoE] Secret for ${req.body.pppoeUsername} created successfully.`);
            } catch (mikrotikError) {
                console.error('[PPPoE] Failed to create secret:', mikrotikError);
                // Jangan gagal proses simpan pelanggan, hanya log errornya
            }
        }
        
        req.flash('success_msg', 'Pelanggan berhasil ditambahkan');
        res.redirect('/customers');
    } catch (error) {
        console.log(error);
        res.render('customers/add', {
            title: 'Tambah Pelanggan',
            packages,
            user: req.session.user,
            errors: [{ msg: 'Terjadi kesalahan' }],
            data: req.body
        });
    }
});

// Edit customer form
router.get('/edit/:id', ensureAuth, async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        const packages = await Package.find({ isActive: true });
        
        if (!customer) {
            return res.redirect('/customers');
        }
        
        res.render('customers/edit', {
            title: 'Edit Pelanggan',
            customer,
            packages,
            user: req.session.user,
            errors: []
        });
    } catch (error) {
        console.log(error);
        res.redirect('/customers');
    }
});

// Update customer
router.put('/edit/:id', ensureAuth, [
    body('name').notEmpty().withMessage('Nama wajib diisi'),
    body('email').isEmail().withMessage('Email tidak valid'),
    body('phone').notEmpty().withMessage('Nomor telepon wajib diisi'),
    body('address').notEmpty().withMessage('Alamat wajib diisi'),
    body('package').notEmpty().withMessage('Paket wajib dipilih')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            const customer = await Customer.findById(req.params.id);
            const packages = await Package.find({ isActive: true });
            
            return res.render('customers/edit', {
                title: 'Edit Pelanggan',
                customer,
                packages,
                user: req.session.user,
                errors: errors.array()
            });
        }
        
        await Customer.findByIdAndUpdate(req.params.id, req.body);
        
        // --- LOGIKA UPDATE SECRET PPPOE ---
        const customerData = await Customer.findById(req.params.id);
        if (customerData.pppoeUsername && customerData.pppoeUsername !== req.body.pppoeUsername) {
            try {
                const conn = await connectToMikrotik();
                const pkg = await Package.findById(req.body.package);
                
                // Hapus secret lama
                const secrets = await conn.write('/ppp/secret/print', [`?name=${customerData.pppoeUsername}`]);
                if (secrets.length > 0) {
                    await conn.write('/ppp/secret/remove', [`=.id=${secrets[0]['.id']}`]);
                }
                
                // Buat secret baru
                await conn.write('/ppp/secret/add', [
                    `=name=${req.body.pppoeUsername}`,
                    `=password=${req.body.pppoeUsername}`,
                    `=service=pppoe` //,
                    //`=profile=${pkg.name}`
                ]);
                
                await conn.close();
                console.log(`[PPPoE] Secret for ${req.body.pppoeUsername} updated successfully.`);
            } catch (mikrotikError) {
                console.error('[PPPoE] Failed to update secret:', mikrotikError);
            }
        }
        
        req.flash('success_msg', 'Pelanggan berhasil diperbarui');
        res.redirect('/customers');
    } catch (error) {
        console.log(error);
        res.redirect('/customers');
    }
});

// Delete customer
router.delete('/:id', ensureAuth, async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        
        // Hapus secret PPPoE di Mikrotik jika ada
        if (customer && customer.pppoeUsername) {
            try {
                const conn = await connectToMikrotik();
                const secrets = await conn.write('/ppp/secret/print', [`?name=${customer.pppoeUsername}`]);
                if (secrets.length > 0) {
                    await conn.write('/ppp/secret/remove', [`=.id=${secrets[0]['.id']}`]);
                    console.log(`[PPPoE] Secret for ${customer.pppoeUsername} deleted.`);
                }
                await conn.close();
            } catch (mikrotikError) {
                console.error('[PPPoE] Failed to delete secret:', mikrotikError);
            }
        }
        
        await Customer.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Pelanggan berhasil dihapus');
        res.redirect('/customers');
    } catch (error) {
        console.log(error);
        res.redirect('/customers');
    }
});


// --- AWAL TAMBAHAN BACKUP/RESTORE ---

// Route untuk mengekspor data pelanggan ke CSV (Backup)
router.get('/export', ensureAuth, async (req, res) => {
    try {
        const customers = await Customer.find().populate('package');

        const csvWriter = createCsvWriter({
            path: 'customers_backup.csv',
            header: [
                { id: 'name', title: 'Nama' },
                { id: 'email', title: 'Email' },
                { id: 'phone', title: 'Telepon' },
                { id: 'address', title: 'Alamat' },
                { id: 'lokasi', title: 'Lokasi' },
                { id: 'status', title: 'Status' },
                { id: 'installationDate', title: 'Tanggal Instalasi' },
                { id: 'teknisiPemasangan', title: 'Teknisi' },
                { id: 'packageName', title: 'Nama Paket' },
                { id: 'packageSpeed', title: 'Kecepatan Paket' },
            ]
        });

        const records = customers.map(customer => ({
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            address: customer.address,
            lokasi: customer.lokasi,
            status: customer.status,
            installationDate: new Date(customer.installationDate).toISOString().split('T')[0], // Format YYYY-MM-DD
            teknisiPemasangan: customer.teknisiPemasangan,
            packageName: customer.package ? customer.package.name : 'N/A',
            packageSpeed: customer.package ? customer.package.speed : 'N/A',
        }));

        await csvWriter.writeRecords(records);

        res.download('customers_backup.csv', 'data_pelanggan.csv', (err) => {
            if (err) console.error(err);
            fs.unlinkSync('customers_backup.csv'); // Hapus file setelah diunduh
        });

    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Gagal membuat backup data.');
        res.redirect('/customers');
    }
});

// Route untuk restore data dari file CSV
router.post('/restore', ensureAuth, upload.single('csvFile'), (req, res) => {
    if (!req.file) {
        req.flash('error_msg', 'Tidak ada file yang diunggah.');
        return res.redirect('/customers');
    }

    const results = [];
    const filePath = path.join(__dirname, '..', req.file.path);

    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            try {
                for (const item of results) {
                    // Cari paket berdasarkan nama dari CSV
                    const package = await Package.findOne({ name: item['Nama Paket'] });
                    
                    if (!package) {
                        console.warn(`Paket "${item['Nama Paket']}" tidak ditemukan. Melewati pelanggan "${item['Nama']}".`);
                        continue; // Lewati jika paket tidak ditemukan
                    }

                    const newCustomer = new Customer({
                        name: item['Nama'],
                        email: item['Email'],
                        phone: item['Telepon'],
                        address: item['Alamat'],
                        lokasi: item['Lokasi'],
                        status: item['Status'],
                        installationDate: item['Tanggal Instalasi'],
                        teknisiPemasangan: item['Teknisi'],
                        package: package._id // Hubungkan dengan ID package yang ditemukan
                    });
                    await newCustomer.save();
                }

                fs.unlinkSync(filePath); // Hapus file yang diunggah
                req.flash('success_msg', `Berhasil restore ${results.length} data pelanggan.`);
                res.redirect('/customers');

            } catch (err) {
                console.error(err);
                fs.unlinkSync(filePath); // Hapus file jika terjadi kesalahan
                req.flash('error_msg', 'Gagal memproses file. Pastikan format CSV benar dan semua paket ada.');
                res.redirect('/customers');
            }
        });
});

// Route untuk mengunduh template CSV
router.get('/template', ensureAuth, (req, res) => {
    const csvWriter = createCsvWriter({
        path: 'template_pelanggan.csv',
        header: [
            { id: 'name', title: 'Nama' },
            { id: 'email', title: 'Email' },
            { id: 'phone', title: 'Telepon' },
            { id: 'address', title: 'Alamat' },
            { id: 'lokasi', title: 'Lokasi' },
            { id: 'status', title: 'Status' },
            { id: 'installationDate', title: 'Tanggal Instalasi (YYYY-MM-DD)' },
            { id: 'teknisiPemasangan', title: 'Teknisi' },
            { id: 'packageName', title: 'Nama Paket' },
        ]
    });

    csvWriter.writeRecords([]).then(() => {
        res.download('template_pelanggan.csv', 'template_pelanggan.csv', (err) => {
            if (err) console.error(err);
            fs.unlinkSync('template_pelanggan.csv'); // Hapus file setelah diunduh
        });
    });
});

// --- AKHIR TAMBAHAN BACKUP/RESTORE ---


module.exports = router;
