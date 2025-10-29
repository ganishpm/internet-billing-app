const axios = require('axios');
const Setting = require('../models/Setting');

/**
 * Mengirim satu pesan WhatsApp.
 * Fungsi ini sekarang menggunakan struktur payload yang benar.
 * @param {string} phoneNumber - Nomor telepon tujuan
 * @param {string} message - Isi pesan
 * @returns {Promise<object>} - Hasil dari API WaBlas
 */
async function sendWhatsAppMessage(phoneNumber, message) {
    // Kita bisa memanggil fungsi bulk dengan hanya satu data
    return sendBulkWhatsAppMessage([{ phone: phoneNumber, message: message }]);
}

/**
 * Mengirim pesan WhatsApp secara massal (bulk) - FUNGSI UTAMA
 * Ini adalah cara yang paling efisien sesuai contoh API WaBlas.
 * @param {Array} payloads - Array dari objek {phone, message}
 * @returns {Promise<object>} - Hasil dari API WaBlas
 */
async function sendBulkWhatsAppMessage(payloads) {
    try {
        const setting = await Setting.findOne();
        if (!setting.wablasApiKey || !setting.wablasSecretKey) {
            throw new Error('API Key atau Secret Key WaBlas tidak dikonfigurasi di pengaturan.');
        }

        // 1. Gabungkan API Key dan Secret Key
        const token = `${setting.wablasApiKey}.${setting.wablasSecretKey}`;

        // 2. Siapkan payload sesuai format WaBlas
        const waBlasPayload = {
            data: payloads // Ini adalah bagian krusialnya
        };

        // 3. Lakukan permintaan POST ke API WaBlas
        const response = await axios.post(`${setting.wablasApiUrl}/api/v2/send-message`, waBlasPayload, {
            headers: {
                'Authorization': token, // Gunakan token yang sudah digabung
                'Content-Type': 'application/json'
            }
        });

        return response.data;

    } catch (error) {
        console.error('[WaBlas Service] Error sending bulk message:', error.response ? error.response.data : error.message);
        throw error; // Lempar error agar bisa ditangani di controller
    }
}

// Hapus atau beri komentar pada fungsi lama yang tidak efisien
// async function broadcastWhatsAppMessage(...) { ... }

module.exports = {
    sendWhatsAppMessage,       // Fungsi untuk kirim 1 pesan (sekarang memanggil bulk)
    sendBulkWhatsAppMessage    // Fungsi utama untuk kirim banyak pesan
};
