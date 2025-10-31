// models/Setting.js
const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
    providerName: { type: String, default: 'Internet Provider' },
    defaultInvoiceDay: { type: Number, default: 5, min: 1, max: 31 },
    pppoeDisableGraceDays: { type: Number, default: 7, min: 0 },
    // --- Pengaturan Mikrotik ---
    mikrotikHost: { type: String, default: '' },
    mikrotikPort: { type: String, default: '8728' },
    mikrotikUser: { type: String, default: '' },
    mikrotikPass: { type: String, default: '' },
    // --- Pengaturan WhatsApp ---
    whatsappProvider: { type: String, default: '' },
    // --- Pengaturan Wablas ---
    wablasApiKey: { type: String, default: '' },
    wablasSecretKey: { type: String, default: '' },
    wablasApiUrl: { type: String, default: 'https://console.wablas.com' },
    // --- Pengaturan Kirimi.ID (PERBAIKAN) ---
    kirimiUserCode: { type: String, default: '' }, // <-- TAMBAHKAN INI
    kirimiSecretKey: { type: String, default: '' }, // <-- TAMBAHKAN INI
    kirimiDeviceId: { type: String, default: '' },
    // --- Template Pesan ---
    waTemplate: { type: String, default: '...' },
    paymentConfirmationTemplate: { type: String, default: '...' },
    invoiceGenerationTemplate: { type: String, default: '...' }
}, { timestamps: true });

module.exports = mongoose.model('Setting', SettingSchema);
