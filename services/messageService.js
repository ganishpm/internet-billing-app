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

// --- Fungsi untuk Kirimi.ID (SUDAH DIPERBAIKI) ---
async function sendKirimiMessage(payloads, setting) {
    try {
        const results = [];
        for (const msg of payloads) {
            // Payload sesuai contoh kode resmi Kirimi.ID
            const data = {
                user_code: setting.kirimiUserCode,
                device_id: setting.kirimiDeviceId,
                receiver: msg.phone, // Pastikan nomor sudah format internasional (contoh: 62812345678)
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

// --- Fungsi Utama ---
async function sendWhatsAppMessage(phoneNumber, message) {
    return sendBulkWhatsAppMessage([{ phone: phoneNumber, message: message }]);
}

async function sendBulkWhatsAppMessage(payloads) {
    const setting = await Setting.findOne();
    if (!setting || !setting.whatsappProvider) {
        throw new Error('Provider WhatsApp belum diatur.');
    }

    if (setting.whatsappProvider === 'wablas') {
        if (!setting.wablasApiKey) throw new Error('API Key WaBlas tidak dikonfigurasi.');
        return await sendWablasMessage(payloads, setting);
    } else if (setting.whatsappProvider === 'kirimi') {
        if (!setting.kirimiUserCode || !setting.kirimiSecretKey || !setting.kirimiDeviceId) {
            throw new Error('User Code, Secret Key, atau Device ID Kirimi.ID tidak dikonfigurasi.');
        }
        return await sendKirimiMessage(payloads, setting);
    } else {
        throw new Error('Provider WhatsApp tidak dikenali.');
    }
}

module.exports = {
    sendWhatsAppMessage,
    sendBulkWhatsAppMessage
};
