const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middleware/auth');
const { ensureAdmin } = require('../middleware/admin');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const moment = require('moment');
const { body, validationResult } = require('express-validator');
const Setting = require('../models/Setting');
const messageService = require('../services/messageService');

// ===================================================================
// D A S H B O A R D  &  I N D E X
// ===================================================================

/**
 * @route   GET /invoices
 * @desc    Menampilkan daftar semua tagihan
 * @access  Private
 */
router.get('/', ensureAuth, async (req, res) => {
    try {
        const invoices = await Invoice.find()
            .populate('customer', 'name email phone')
            .populate('package', 'name speed price')
            .sort({ createdAt: -1 });

        res.render('invoices/index', {
            title: 'Tagihan',
            invoices,
            user: req.session.user,
            moment
        });
    } catch (error) {
        console.error(error);
        res.render('invoices/index', {
            title: 'Tagihan',
            invoices: [],
            user: req.session.user,
            moment
        });
    }
});

/**
 * @route   GET /invoices/add
 * @desc    Menampilkan form untuk membuat tagihan baru
 * @access  Private
 */
router.get('/add', ensureAuth, async (req, res) => {
    try {
        const customers = await Customer.find({ status: 'active' }).populate('package');
        res.render('invoices/add', {
            title: 'Buat Tagihan',
            customers,
            user: req.session.user,
            moment
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Gagal memuat halaman tambah tagihan.');
        res.redirect('/invoices');
    }
});

/**
 * @route   POST /invoices/add
 * @desc    Proses pembuatan tagihan baru
 * @access  Private
 */
router.post('/add', ensureAuth, async (req, res) => {
    try {
        const { customer, period } = req.body;
        const customerData = await Customer.findById(customer).populate('package');

        if (!customerData || !customerData.package) {
            req.flash('error_msg', 'Pelanggan atau paket tidak ditemukan.');
            return res.redirect('/invoices/add');
        }

        const invoiceNumber = `INV-${Date.now()}`;
        const dueDate = moment().add(30, 'days').toDate();

        const invoice = new Invoice({
            invoiceNumber,
            customer,
            package: customerData.package._id,
            amount: customerData.package.price,
            dueDate,
            period,
            status: 'unpaid'
        });

        await invoice.save();
        req.flash('success_msg', 'Tagihan berhasil dibuat');
        res.redirect('/invoices');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Terjadi kesalahan saat membuat tagihan.');
        res.redirect('/invoices');
    }
});

/**
 * @route   GET /invoices/view/:id
 * @desc    Menampilkan detail satu tagihan
 * @access  Private
 */
router.get('/view/:id', ensureAuth, async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate('customer', 'name email phone address')
            .populate('package', 'name speed price description');

        if (!invoice) {
            req.flash('error_msg', 'Tagihan tidak ditemukan');
            return res.redirect('/invoices');
        }

        const payments = await Payment.find({ invoice: invoice._id });

        res.render('invoices/view', {
            title: `Tagihan ${invoice.invoiceNumber}`,
            invoice,
            payments,
            user: req.session.user,
            moment
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Gagal memuat detail tagihan.');
        res.redirect('/invoices');
    }
});

// ===================================================================
// C R U D  -  C R E A T E ,  R E A D ,  U P D A T E ,  D E L E T E
// ===================================================================

/**
 * @route   POST /invoices/generate-monthly
 * @desc    Membuat tagihan bulanan untuk semua pelanggan aktif
 * @access  Private (Admin)
 */
router.post('/generate-monthly', ensureAuth, ensureAdmin, async (req, res) => {
    try {
        const { month, year } = req.body;
        const currentPeriod = `${month}-${year}`;
        let prevMonth = parseInt(month) - 1;
        let prevYear = year;
        if (prevMonth < 1) {
            prevMonth = 12;
            prevYear = parseInt(year) - 1;
        }
        const prevPeriod = `${String(prevMonth).padStart(2, '0')}-${prevYear}`;

        const customers = await Customer.find({ status: 'active' }).populate('package');
        let createdCount = 0;

        for (const customer of customers) {
            const existingInvoice = await Invoice.findOne({ customer: customer._id, period: currentPeriod });
            if (!existingInvoice) {
                let totalAmount = customer.package.price;
                let tunggakanAmount = 0;

                const previousInvoice = await Invoice.findOne({ customer: customer._id, period: prevPeriod, status: 'unpaid' });
                if (previousInvoice) {
                    tunggakanAmount = previousInvoice.amount;
                    totalAmount += tunggakanAmount;
                }

                const invoiceNumber = `INV-${Date.now()}-${customer._id.toString().slice(-4)}`;
                const dueDate = moment(`${year}-${month}-01`).add(30, 'days').toDate();

                await new Invoice({
                    invoiceNumber,
                    customer: customer._id,
                    package: customer.package._id,
                    amount: totalAmount,
                    dueDate,
                    period: currentPeriod,
                    status: 'unpaid',
                    notes: tunggakanAmount > 0 ? `Termasuk tunggakan bulan ${prevPeriod} sebesar Rp ${tunggakanAmount.toLocaleString('id-ID')}` : ''
                }).save();
                createdCount++;
            }
        }

        req.flash('success_msg', `${createdCount} tagihan bulanan berhasil dibuat.`);
        res.redirect('/invoices');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Terjadi kesalahan saat membuat tagihan bulanan.');
        res.redirect('/invoices');
    }
});

/**
 * @route   GET /invoices/edit/:id
 * @desc    Menampilkan form edit tagihan
 * @access  Private
 */
router.get('/edit/:id', ensureAuth, async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id).populate('customer');
        if (!invoice || invoice.status === 'paid') {
            req.flash('error_msg', invoice ? 'Tagihan yang sudah lunas tidak dapat diedit' : 'Tagihan tidak ditemukan');
            return res.redirect('/invoices');
        }

        res.render('invoices/edit', {
            title: 'Edit Tagihan',
            invoice,
            user: req.session.user,
            errors: []
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Terjadi kesalahan.');
        res.redirect('/invoices');
    }
});

/**
 * @route   PUT /invoices/edit/:id
 * @desc    Memproses update tagihan
 * @access  Private
 */
router.put('/edit/:id', ensureAuth, [
    body('dueDate').notEmpty().withMessage('Tanggal jatuh tempo wajib diisi'),
    body('amount').isNumeric().withMessage('Jumlah harus berupa angka')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const invoice = await Invoice.findById(req.params.id).populate('customer');
            return res.render('invoices/edit', {
                title: 'Edit Tagihan',
                invoice,
                user: req.session.user,
                errors: errors.array()
            });
        }

        await Invoice.findByIdAndUpdate(req.params.id, req.body);
        req.flash('success_msg', 'Tagihan berhasil diperbarui');
        res.redirect('/invoices');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Terjadi kesalahan.');
        res.redirect('/invoices');
    }
});

/**
 * @route   DELETE /invoices/:id
 * @desc    Menghapus tagihan
 * @access  Private
 */
router.delete('/:id', ensureAuth, async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice || invoice.status === 'paid') {
            req.flash('error_msg', invoice ? 'Tagihan yang sudah lunas tidak dapat dihapus' : 'Tagihan tidak ditemukan');
            return res.redirect('/invoices');
        }

        const payment = await Payment.findOne({ invoice: invoice._id });
        if (payment) {
            req.flash('error_msg', 'Tidak dapat menghapus tagihan yang sudah tercatat pembayarannya.');
            return res.redirect('/invoices');
        }

        await Invoice.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Tagihan berhasil dihapus');
        res.redirect('/invoices');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Terjadi kesalahan.');
        res.redirect('/invoices');
    }
});

// ===================================================================
//                      B U L K  D E L E T E
// ===================================================================

/**
 * @route   POST /invoices/bulk-delete
 * @desc    Menghapus beberapa tagihan sekaligus
 * @access  Private (Admin) - Dibatasi untuk admin karena ini tindakan berisiko tinggi
 */
router.post('/bulk-delete', ensureAuth, ensureAdmin, async (req, res) => {
    try {
        // 1. Ambil array ID dari request body
        const { ids } = req.body;

        // 2. Validasi input
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Tidak ada tagihan yang dipilih untuk dihapus.'
            });
        }

        // 3. Cari tagihan yang akan dihapus untuk validasi tambahan (opsional, tapi direkomendasikan)
        const invoicesToDelete = await Invoice.find({ _id: { $in: ids } });
        const paidInvoices = invoicesToDelete.filter(inv => inv.status === 'paid');
        if (paidInvoices.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Tidak dapat menghapus tagihan yang sudah lunas.'
            });
        }
        
        // 4. Hapus semua tagihan yang ID-nya ada di dalam array `ids`
        const result = await Invoice.deleteMany({ _id: { $in: ids }, status: { $ne: 'paid' } });

        // 5. Kirim response sukses dalam format JSON
        res.status(200).json({
            success: true,
            message: `Berhasil menghapus ${result.deletedCount} tagihan.`
        });

    } catch (error) {
        console.error('Bulk Delete Error:', error);
        // 6. Tangani jika terjadi error
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server saat menghapus tagihan.'
        });
    }
});


// ===================================================================
// B R O A D C A S T  &  N O T I F I K A S I
// ===================================================================

/**
 * @route   POST /invoices/broadcast-reminder
 * @desc    Mengirim pesan pengingat otomatis ke semua pelanggan dengan tagihan menunggak
 * @access  Private (Admin)
 */
router.post('/broadcast-reminder', ensureAuth, ensureAdmin, async (req, res) => {
    try {
        const unpaidInvoices = await Invoice.find({ status: 'unpaid' })
            .populate('customer', 'name phone')
            .populate('package', 'name price');

        if (unpaidInvoices.length === 0) {
            return res.json({ success: false, message: 'Tidak ada tagihan menunggak yang perlu diingatkan.' });
        }

        const setting = await Setting.findOne();
        const messageTemplate = setting.waTemplate || 'Halo {customer_name}, tagihan Anda {invoice_number} sebesar Rp {amount} belum dibayar.';

        const messagePayloads = unpaidInvoices.map(invoice => {
            const personalizedMessage = messageTemplate
                .replace(/{customer_name}/g, invoice.customer.name)
                .replace(/{invoice_number}/g, invoice.invoiceNumber)
                .replace(/{amount}/g, invoice.amount.toLocaleString('id-ID'))
                .replace(/{due_date}/g, moment(invoice.dueDate).format('DD MMMM YYYY'));

            return {
                phone: invoice.customer.phone,
                message: personalizedMessage
            };
        });

        const result = await messageService.sendBulkWhatsAppMessage(messagePayloads);

        console.log(`[Invoice Reminder Broadcast] Pesan dikirim ke ${messagePayloads.length} pelanggan menunggak.`);
        res.json({
            success: true,
            message: `Pesan pengingat berhasil dikirim ke ${messagePayloads.length} pelanggan menunggak.`,
            data: result
        });

    } catch (error) {
        console.error('[Invoice Reminder Broadcast Error]:', error.message);
        res.status(500).json({ success: false, message: 'Gagal mengirim pesan pengingat.', error: error.message });
    }
});

module.exports = router;
