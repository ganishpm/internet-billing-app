const express = require('express');
const router = express.Router();
const { RouterOSAPI } = require('node-routeros');
const { ensureAuth } = require('../middleware/auth');
const { ensureAdmin } = require('../middleware/admin');
const Setting = require('../models/Setting');

// Helper untuk mendapatkan setting dari database
const getSettingFromDB = async (key, defaultValue) => {
    const setting = await Setting.findOne();
    return setting && setting[key] ? setting[key] : defaultValue;
};

// Fungsi untuk koneksi ke Mikrotik
// Fungsi untuk koneksi ke Mikrotik
async function connectToMikrotik() {
    try {
        const host = await getSettingFromDB('mikrotikHost');
        const port = await getSettingFromDB('mikrotikPort') || '8728';
        const user = await getSettingFromDB('mikrotikUser');
        const password = await getSettingFromDB('mikrotikPass');
        
        if (!host || !user || !password) {
            throw new Error('Konfigurasi Mikrotik tidak lengkap. Silakan atur di menu Settings.');
        }
        
        const conn = new RouterOSAPI({
            host: host,
            port: port,
            user: user,
            password: password,
            timeout: 5000
        });
        
        await conn.connect();
        console.log(`[PPPoE] Connected to Mikrotik at ${host}:${port}`);
        return conn;
    } catch (error) {
        console.error(`[PPPoE] Error connecting to Mikrotik: ${error.message}`);
        throw error;
    }

}

// GET /pppoe - Halaman utama monitoring
router.get('/', ensureAuth, async (req, res) => {
    res.render('pppoe/index', {
        title: 'Monitoring PPPoE',
        user: req.session.user
    });
});

// GET /pppoe/data - API endpoint untuk mengambil data user
router.get('/data', ensureAuth, async (req, res) => {
    try {
        const conn = await connectToMikrotik();
        
        // Ambil semua secret PPPoE
        const pppSecrets = await conn.write('/ppp/secret/print');
        
        // Ambil semua koneksi aktif
        const activeConnections = await conn.write('/ppp/active/print');
        const activeUsers = activeConnections.reduce((acc, conn) => {
            acc[conn.name] = conn;
            return acc;
        }, {});

        // Gabungkan data
        const users = pppSecrets.map(secret => {
            const active = activeUsers[secret.name];
            return {
                '.id': secret['.id'],
                name: secret.name,
                profile: secret.profile,
                callerId: active ? active['caller-id'] : '-',
                address: active ? active.address : '-',
                uptime: active ? active.uptime : '0s',
                disabled: secret.disabled === 'true',
                active: !!active
            };
        });

        await conn.close();
        res.json({ success: true, data: users });

    } catch (error) {
        console.error('[PPPoE] Error fetching data:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /pppoe/enable/:name - Enable user
router.post('/enable/:name', ensureAuth, ensureAdmin, async (req, res) => {
    try {
        const { name } = req.params;
        const conn = await connectToMikrotik();
        
        // Cari ID user
        const secrets = await conn.write('/ppp/secret/print', [`?name=${name}`]);
        if (secrets.length === 0) {
            throw new Error('User tidak ditemukan');
        }

        // Enable user
        await conn.write('/ppp/secret/set', [
            '=.id=' + secrets[0]['.id'],
            '=disabled=no'
        ]);
        
        await conn.close();
        res.json({ success: true, message: `User ${name} berhasil di-enable` });

    } catch (error) {
        console.error(`[PPPoE] Error enabling user ${req.params.name}:`, error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /pppoe/disable/:name - Disable user
router.post('/disable/:name', ensureAuth, ensureAdmin, async (req, res) => {
    try {
        const { name } = req.params;
        const conn = await connectToMikrotik();
        
        // Cari ID user
        const secrets = await conn.write('/ppp/secret/print', [`?name=${name}`]);
        if (secrets.length === 0) {
            throw new Error('User tidak ditemukan');
        }

        // Disable user
        await conn.write('/ppp/secret/set', [
            '=.id=' + secrets[0]['.id'],
            '=disabled=yes'
        ]);
        
        // Kick user dari sesi aktif jika ada
        const activeConnections = await conn.write('/ppp/active/print', [`?name=${name}`]);
        if (activeConnections.length > 0) {
            await conn.write('/ppp/active/remove', [
                '=.id=' + activeConnections[0]['.id']
            ]);
        }

        await conn.close();
        res.json({ success: true, message: `User ${name} berhasil di-disable dan di-kick` });

    } catch (error) {
        console.error(`[PPPoE] Error disabling user ${req.params.name}:`, error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /pppoe/secrets - API endpoint untuk mengambil daftar secret PPPoE
router.get('/secrets', ensureAuth, async (req, res) => {
    try {
        const conn = await connectToMikrotik();
        // Ambil semua secret PPPoE
        const secrets = await conn.write('/ppp/secret/print');
        await conn.close();
        
        // Filter hanya yang memiliki nama dan password
        const validSecrets = secrets.filter(secret => secret.name && secret.password);
        
        res.json({ success: true, data: validSecrets });
    } catch (error) {
        console.error('[PPPoE] Error fetching secrets:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
