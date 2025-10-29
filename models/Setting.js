const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
    providerName: {
        type: String,
        default: 'Internet Provider'
    },
    defaultInvoiceDay: {
        type: Number,
        default: 5,
        min: 1,
        max: 31
    },
    pppoeDisableGraceDays: { // <-- TAMBAHKAN INI
        type: Number,
        default: 7,
        min: 0
    },
    mikrotikHost: {
        type: String,
        default: ''
    },
    mikrotikPort: { 
        type: String,
        default: '8728'
    },
    mikrotikUser: {
        type: String,
        default: ''
    },
    mikrotikPass: {
        type: String,
        default: ''
    },
    wablasApiKey: {
        type: String,
        default: ''
    },
    wablasSecretKey: { // <-- TAMBAHKAN INI
        type: String,
        default: ''
    },
    wablasApiUrl: { // <-- TAMBAHKAN INI
        type: String,
        default: 'https://console.wablas.com'
    },
    waTemplate: { // <-- TAMBAHKAN INI
        type: String,
        default: 'Halo {customer_name},\nTagihan Anda {invoice_number} sebesar Rp {amount} telah jatuh tempo.\nSegera lakukan pembayaran untuk menghindari penonaktifanan layanan.\n\nTerima kasih.'
    },
    paymentConfirmationTemplate: { // <-- TAMBAHKAN INI
        type: String, 
        default: 'Hormat {customer_name},\nPembayaran Anda untuk tagihan {invoice_number} sebesar Rp {amount} telah kami terima.\nTerima kasih atas kepercayaan Anda.\n\nLayanan Anda aktif kembali.' 
    },
    invoiceGenerationTemplate: { // <-- TAMBAHKAN INI
        type: String, 
        default: 'Hormat Pelanggan Yth,\nTagihan Internet untuk periode {period} telah dibuat.\nSilakan cek tagihan Anda di member area atau hubungi kami.\n\nTerima kasih.' 
    }
},    {
    timestamps: true
    
});

// Kita hanya butuh satu dokumen setting
module.exports = mongoose.model('Setting', SettingSchema);

