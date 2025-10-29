console.log('Loading broadcast.js...');

const express = require('express');
const router = express.Router();

console.log('Requiring middleware/auth...');
try {
    var { ensureAuth} = require('../middleware/auth');
    console.log('middleware/auth loaded successfully.');
} catch (e) {
    console.error('Error loading middleware/auth:', e);
}
const { ensureAdmin } = require('../middleware/admin');
console.log('Requiring models/Customer...');
try {
    var Customer = require('../models/Customer');
    console.log('models/Customer loaded successfully.');
} catch (e) {
    console.error('Error loading models/Customer:', e);
}

console.log('Requiring services/messageService...');
try {
    var messageService = require('../services/messageService');
    console.log('services/messageService loaded successfully.');
} catch (e) {
    console.error('Error loading services/messageService:', e);
}


// POST /broadcast/send (UNTUK PENGUMUMAN UMUM)
router.post('/send', ensureAuth, ensureAdmin, async (req, res) => {
    // ... isi fungsi tetap sama ...
    try {
        const { recipientIds, message } = req.body;

        if (!recipientIds || recipientIds.length === 0 || !message) {
            return res.status(400).json({ 
                success: false, 
                message: 'Pilih setidaknya satu pelanggan dan isi pesan.' 
            });
        }

        const customers = await Customer.find({ '_id': { $in: recipientIds } });

        if (customers.length === 0) {
            return res.json({ 
                success: false, 
                message: 'Pelanggan yang dipilih tidak ditemukan.' 
            });
        }

        const payloads = customers.map(customer => ({
            phone: customer.phone,
            message: message
        }));

        const result = await messageService.sendBulkWhatsAppMessage(payloads);

        console.log(`[Announcement Broadcast] Pengumuman dikirim ke ${payloads.length} pelanggan.`);
        res.json({
            success: true,
            message: `Pengumuman berhasil dikirim ke ${payloads.length} pelanggan.`,
            data: result
        });

    } catch (error) {
        console.error('[Announcement Broadcast Error]:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengirim pengumuman.', 
            error: error.message 
        });
    }
});

module.exports = router;
