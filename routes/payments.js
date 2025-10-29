const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middleware/auth');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Setting = require('../models/Setting'); // <-- Tambahkan ini
const moment = require('moment');
const messageService = require('../services/messageService'); // <-- Perbaiki import ini

// ===================================================================
// I N D E K
// ===================================================================

/**
 * @route   GET /payments
 * @desc    Menampilkan daftar semua pembayaran
 * @access  Private
 */
router.get('/', ensureAuth, async (req, res) => {
    try {
        const payments = await Payment.find()
            .populate('customer', 'name email')
            .populate('invoice', 'invoiceNumber period')
            .sort({ createdAt: -1 });
        res.render('payments/index', {
            title: 'Pembayaran',
            payments,
            user: req.session.user,
            moment
        });
    } catch (error) {
        console.error(error);
        res.render('payments/index', {
            title: 'Pembayaran',
            payments: [],
            user: req.session.user,
            moment
        });
    }
});

// ===================================================================
// T A M B A H  P E M B A Y A R A N
// ===================================================================

/**
 * @route   GET /payments/add/:invoiceId
 * @desc    Menampilkan form untuk menambah pembayaran
 * @access  Private
 */
router.get('/add/:invoiceId', ensureAuth, async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.invoiceId)
            .populate('customer', 'name')
            .populate('package', 'name price');
        if (!invoice) {
            req.flash('error_msg', 'Tagihan tidak ditemukan');
            return res.redirect('/invoices');
        }
        res.render('payments/add', {
            title: 'Tambah Pembayaran',
            invoice,
            user: req.session.user
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Terjadi kesalahan saat memuat halaman');
        res.redirect('/invoices');
    }
});

/**
 * @route   POST /payments/add/:invoiceId
 * @desc    Memproses penambahan pembayaran dan mengirim notifikasi WhatsApp
 * @access  Private
 */
router.post('/add/:invoiceId', ensureAuth, async (req, res) => {
    try {
        const { method, reference } = req.body;
        const invoice = await Invoice.findById(req.params.invoiceId).populate('customer');

        if (!invoice) {
            req.flash('error_msg', 'Tagihan tidak ditemukan');
            return res.redirect('/invoices');
        }
        if (invoice.status === 'paid') {
            req.flash('error_msg', 'Tagihan ini sudah lunas');
            return res.redirect('/invoices/view/' + invoice._id);
        }

        // 1. Simpan data pembayaran
        const payment = new Payment({
            invoice: invoice._id,
            customer: invoice.customer._id,
            amount: invoice.amount,
            paymentDate: new Date(),
            method,
            reference,
            status: 'success'
        });
        await payment.save();

        // 2. Update status tagihan menjadi lunas
        invoice.status = 'paid';
        await invoice.save();

        // 3. Kirim notifikasi WhatsApp (Asynchronous)
        // Kita tidak menggunakan 'await' agar pengguna tidak perlu menunggu pesan terkirim
        sendPaymentNotification(invoice, payment);

        req.flash('success_msg', 'Pembayaran berhasil dicatat');
        res.redirect('/invoices/view/' + invoice._id);

    } catch (error) {
        console.error('[Payment Creation Error]:', error);
        req.flash('error_msg', 'Terjadi kesalahan saat mencatat pembayaran');
        res.redirect('/invoices/view/' + req.params.invoiceId);
    }
});

/**
 * Fungsi helper untuk mengirim notifikasi pembayaran
 * @param {object} invoice - Objek tagihan yang sudah lunas
 * @param {object} payment - Objek pembayaran yang baru dibuat
 */
async function sendPaymentNotification(invoice, payment) {
    try {
        const setting = await Setting.findOne();
        let messageTemplate = setting.paymentConfirmationTemplate;

        // Jika template tidak ada di setting, gunakan template default
        if (!messageTemplate) {
            messageTemplate = 'Hormat {customer_name},\nPembayaran Anda untuk tagihan {invoice_number} sebesar Rp {amount} telah kami terima.\nTerima kasih atas kepercayaan Anda.';
        }

        // Ganti placeholder dengan data asli
        const personalizedMessage = messageTemplate
            .replace(/{customer_name}/g, invoice.customer.name)
            .replace(/{invoice_number}/g, invoice.invoiceNumber)
            .replace(/{amount}/g, invoice.amount.toLocaleString('id-ID'))
            .replace(/{payment_date}/g, moment(payment.paymentDate).format('DD MMMM YYYY'));

        const payload = {
            phone: invoice.customer.phone,
            message: personalizedMessage
        };

        // Kirim menggunakan service bulk (meskipun hanya satu pesan)
        await messageService.sendBulkWhatsAppMessage([payload]);
        console.log(`[WaBlas] Payment notification sent to ${invoice.customer.name} for ${invoice.invoiceNumber}`);

    } catch (error) {
        console.error('[WaBlas] Failed to send payment notification:', error.message);
    }
}


module.exports = router;
