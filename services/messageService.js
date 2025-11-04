// services/messageService.js
const axios = require('axios');
const Setting = require('../models/Setting');

// --- Fungsi untuk WaBlas (tidak berubah) ---
async function sendWablasMessage(payloads, setting) {
    try {
        const token = `${setting.wablasApiKey}.${setting.wablasSecretKey}`;
        const waBlasPayload = { data: payloads };
        const response = await axios.post(`${setting.wablasApiUrl}/api/v2/send-message`, waBlasPayload, {
            headers: { 'Authorization': token, 'Content-Type': 'application/json' }
        });
        console.log('[WaBlas Service] Pesan terkirim:', response.data);
        return response.data;
    } catch (error) {
        console.error('[WaBlas Service] Error sending message:', error.response ? error.response.data : error.message);
        throw new Error('Gagal mengirim pesan via WaBlas.');
    }
}

// --- Fungsi untuk Kirimi.ID (tidak berubah) ---
async function sendKirimiMessage(payloads, setting) {
    try {
        const results = [];
        for (const msg of payloads) {
            const data = {
                user_code: setting.kirimiUserCode,
                device_id: setting.kirimiDeviceId,
                receiver: msg.phone,
                message: msg.message,
                secret: setting.kirimiSecretKey
            };

            const { data: responseData } = await axios.post('https://api.kirimi.id/v1/send-message', data);
            console.log('[Kirimi.ID Service] Pesan terkirim ke', msg.phone, ':', responseData);
            results.push(responseData);
        }
        return results;
    } catch (error) {
        console.error('[Kirimi.ID Service] Error sending message:', error.response ? error.response.data : error.message);
        throw new Error('Gagal mengirim pesan via Kirimi.ID.');
    }
}

// --- TAMBAHKAN FUNGSI UNTUK WEAGATE ---
async function sendWeagateMessage(payloads, setting) {
    try {
        if (!setting.weagateToken) {
            throw new Error('Token WeaGate tidak dikonfigurasi.');
        }

        const results = [];
        const endpoint = 'https://mywifi.weagate.com/api/send-message';

        // WeaGate mengirim pesan satu per satu, jadi kita perlu loop
        for (const msg of payloads) {
            const payload = {
                token: setting.weagateToken,
                to: msg.phone,
                type: 'text',
                message: msg.message
            };

            const response = await axios.post(endpoint, payload, {
                headers: { 'Accept': 'application/json' }
            });

            console.log('[WeaGate Service] Pesan terkirim ke', msg.phone, ':', response.data);
            results.push({ success: true, to: msg.phone, data: response.data });
        }
        return results;
    } catch (error) {
        console.error('[WeaGate Service] Error sending message:', error.response ? error.response.data : error.message);
        // Lempar error agar bisa ditangkap oleh fungsi pemanggil
        throw new Error('Gagal mengirim pesan via WeaGate.');
    }
}
// --- TAMBAHKAN FUNGSI TEST KONEKSI WEAGATE DI SINI ---
async function testWeagateConnection(token) {
    try {
        if (!token) {
            return { success: false, message: 'Token WeaGate wajib diisi.' };
        }

        const endpoint = 'https://mywifi.weagate.com/api/device-status';
        const payload = {
            token: token,
            to: '6281234567890', // Nomor tujuan untuk tes
            type: 'text',
            message: 'Test koneksi WeaGate dari aplikasi Anda berhasil!'
        };

        const response = await axios.post(endpoint, payload, {
            headers: { 'Accept': 'application/json' }
        });

        return { success: true, message: 'Koneksi ke WeaGate berhasil! Pesan tes terkirim.', data: response.data };

    } catch (error) {
        console.error('WeaGate Test Connection Error:', error.response ? error.response.data : error.message);
        const errorMessage = error.response && error.response.data && error.response.data.message 
            ? error.response.data.message 
            : 'Gagal terhubung ke WeaGate. Periksa token Anda.';
        return { success: false, message: errorMessage };
    }
}

// --- FUNGSI UTAMA (DIPERBARUI) ---
async function sendWhatsAppMessage(phoneNumber, message) {
    return sendBulkWhatsAppMessage([{ phone: phoneNumber, message: message }]);
}

async function sendBulkWhatsAppMessage(payloads) {
    const setting = await Setting.findOne();
    if (!setting || !setting.whatsappProvider) {
        throw new Error('Provider WhatsApp belum diatur.');
    }

    // --- GUNAKAN PENGATURAN DARI DATABASE ---
    const limit = setting.limitPesan || 10; // Ambil limit, default ke 10
    const delayInMs = (setting.jedaWaktu || 60) * 1000; // Ambil jeda, default ke 60 detik

    // Batasi payload sesuai setting
    const limitedPayloads = payloads.slice(0, limit);

    if (limitedPayloads.length === 0) {
        console.log('[Broadcast] Tidak ada pesan untuk dikirim setelah penerapan limit.');
        return [];
    }

    console.log(`[Broadcast] Memulai pengiriman ${limitedPayloads.length} pesan dengan jeda ${delayInMs / 1000} detik per pesan.`);

    const results = [];
    // PERULANGAN MENGGUNAKAN NILAI YANG SUDAH DITENTUKAN
    for (const payload of limitedPayloads) {
        try {
            console.log(`[Broadcast] Mengirim pesan ke ${payload.phone}...`);

            let result;
            const singlePayload = [payload];

            if (setting.whatsappProvider === 'wablas') {
                if (!setting.wablasApiKey) throw new Error('API Key WaBlas tidak dikonfigurasi.');
                const wablasResponse = await sendWablasMessage(singlePayload, setting);
                result = { success: true, to: payload.phone, data: wablasResponse };
            } else if (setting.whatsappProvider === 'kirimi') {
                if (!setting.kirimiUserCode || !setting.kirimiSecretKey || !setting.kirimiDeviceId) {
                    throw new Error('User Code, Secret Key, atau Device ID Kirimi.ID tidak dikonfigurasi.');
                }
                const kirimiResponseArray = await sendKirimiMessage(singlePayload, setting);
                result = kirimiResponseArray[0];
            } else if (setting.whatsappProvider === 'weagate') {
                if (!setting.weagateToken) throw new Error('Token WeaGate tidak dikonfigurasi.');
                const weagateResponseArray = await sendWeagateMessage(singlePayload, setting);
                result = weagateResponseArray[0];
            } else {
                throw new Error('Provider WhatsApp tidak dikenali.');
            }
            
            results.push(result);
            console.log(`[Broadcast] Berhasil mengirim ke ${payload.phone}. Menunggu ${delayInMs / 1000} detik untuk pesan berikutnya.`);

        } catch (error) {
            console.error(`[Broadcast] Gagal mengirim ke ${payload.phone}:`, error.message);
            results.push({ success: false, to: payload.phone, error: error.message });
        }

        // Jeda kecuali untuk pesan terakhir
        if (limitedPayloads.indexOf(payload) < limitedPayloads.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayInMs));
        }
    }

    console.log('[Broadcast] Semua pesan telah diproses.');
    return results;
}

module.exports = {
    sendWhatsAppMessage,
    sendBulkWhatsAppMessage,
    testWeagateConnection
};
