const cron = require('node-cron');
const mongoose = require('mongoose');
const Invoice = require('./models/Invoice');
const Customer = require('./models/Customer');
const Setting = require('./models/Setting');
const { RouterOSAPI } = require('node-routeros');

// Helper untuk koneksi ke Mikrotik
async function connectToMikrotik() {
    try {
        const setting = await Setting.findOne();
        if (!setting.mikrotikHost || !setting.mikrotikUser || !setting.mikrotikPass) {
            console.log('[Scheduler] Mikrotik not configured, skipping PPPoE check.');
            return null;
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
        console.error('[Scheduler] Error connecting to Mikrotik:', error.message);
        return null;
    }
}

// Fungsi utama untuk menonaktifkan user
async function checkAndDisableOverdueUsers() {
    console.log('[Scheduler] Running check for overdue PPPoE users...');
    
    try {
        // 1. Ambil setting grace period
        const setting = await Setting.findOne();
        const graceDays = setting.pppoeDisableGraceDays || 7;
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset ke tengah malam untuk perbandingan tanggal

        // 2. Cari semua tagihan yang belum dibayar dan sudah lewat jatuh tempo + grace period
        const overdueInvoices = await Invoice.find({
            status: 'unpaid',
            dueDate: { $lt: new Date(today.getTime() - (graceDays * 24 * 60 * 60 * 1000)) }
        }).populate('customer');

        if (overdueInvoices.length === 0) {
            console.log('[Scheduler] No overdue invoices found.');
            return;
        }

        console.log(`[Scheduler] Found ${overdueInvoices.length} overdue invoices.`);

        // 3. Loop untuk menonaktifkan user
        for (const invoice of overdueInvoices) {
            if (invoice.customer && invoice.customer.pppoeUsername) {
                try {
                    const conn = await connectToMikrotik();
                    if (!conn) continue;

                    // Cari secret user di Mikrotik
                    const secrets = await conn.write('/ppp/secret/print', [`?name=${invoice.customer.pppoeUsername}`]);
                    
                    if (secrets.length > 0) {
                        // Nonaktifkan secret
                        await conn.write('/ppp/secret/set', [
                            '=.id=' + secrets[0]['.id'],
                            '=disabled=yes'
                        ]);
                        
                        // Kick user dari sesi aktif jika ada
                        const activeConnections = await conn.write('/ppp/active/print', [`?name=${invoice.customer.pppoeUsername}`]);
                        if (activeConnections.length > 0) {
                            await conn.write('/ppp/active/remove', [
                                '=.id=' + activeConnections[0]['.id']
                            ]);
                        }
                        
                        console.log(`[Scheduler] Disabled PPPoE user: ${invoice.customer.pppoeUsername} for invoice ${invoice.invoiceNumber}`);
                    }
                    
                    await conn.close();
                } catch (error) {
                    console.error(`[Scheduler] Failed to disable user ${invoice.customer.pppoeUsername}:`, error.message);
                }
            }
        }
    } catch (error) {
        console.error('[Scheduler] An error occurred during check:', error);
    }
}

// Koneksi ke database
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('[Scheduler] Connected to MongoDB.');
    
    // Jalankan setiap hari pada pukul 02:00 pagi
    cron.schedule('0 2 * * *', () => {
        checkAndDisableOverdueUsers();
    });
    
    console.log('[Scheduler] PPPoE checker scheduled to run every day at 02:00.');
}).catch(err => {
    console.error('[Scheduler] MongoDB connection error:', err);
});
