const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middleware/auth');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Package = require('../models/Package');
const moment = require('moment');

// Dashboard
router.get('/', ensureAuth, async (req, res) => {
    try {
        // Get statistics
        const totalCustomers = await Customer.countDocuments({ status: 'active' });
        const totalPackages = await Package.countDocuments({ isActive: true });
        const unpaidInvoices = await Invoice.countDocuments({ status: 'unpaid' });
        const totalRevenue = await Payment.aggregate([
            { $match: { status: 'success' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Get recent invoices
        const recentInvoices = await Invoice.find()
            .populate('customer', 'name email')
            .sort({ createdAt: -1 })
            .limit(5);

        // Get recent payments
        const recentPayments = await Payment.find()
            .populate('customer', 'name')
            .sort({ createdAt: -1 })
            .limit(5);

        // Monthly revenue (last 6 months)
        const monthlyRevenue = await Payment.aggregate([
            {
                $match: {
                    status: 'success',
                    paymentDate: {
                        $gte: new Date(moment().subtract(6, 'months').startOf('month'))
                    }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$paymentDate' },
                        month: { $month: '$paymentDate' }
                    },
                    total: { $sum: '$amount' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // --- TAMBAHKAN INI: Ambil semua pelanggan aktif untuk modal broadcast ---
        const customers = await Customer.find({ status: 'active' });

        res.render('dashboard', {
            title: 'Dashboard',
            user: req.session.user,
            stats: {
                totalCustomers,
                totalPackages,
                unpaidInvoices,
                totalRevenue: totalRevenue[0]?.total || 0
            },
            recentInvoices,
            recentPayments,
            monthlyRevenue,
            customers, // <-- Kirim data customers ke view
            moment
        });
    } catch (error) {
        console.log(error);
        // Jangan lupa tambahkan customers: [] di bagian error juga
        res.render('dashboard', {
            title: 'Dashboard',
            user: req.session.user,
            stats: {
                totalCustomers: 0,
                totalPackages: 0,
                unpaidInvoices: 0,
                totalRevenue: 0
            },
            recentInvoices: [],
            recentPayments: [],
            monthlyRevenue: [],
            customers: [], // <-- Kirim array kosong jika terjadi error
            moment
        });
    }
});
module.exports = router;
