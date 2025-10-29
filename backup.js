const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Customer = require('./models/Customer');
require('dotenv').config();

const backupDir = './backups';
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
}

const performBackup = async () => {
    console.log(`[${new Date().toLocaleString()}] Memulai backup otomatis...`);
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const customers = await Customer.find().populate('package', 'name speed price').lean();
        
        const csvHeader = 'Nama,Email,Telepon,Alamat,Lokasi,Teknisi,Paket,Status,Tanggal Instalasi\n';
        const csvRows = customers.map(c => 
            `"${c.name}","${c.email}","${c.phone}","${c.address}","${c.lokasi}","${c.teknisiPemasangan}","${c.package.name}","${c.status}","${c.installationDate.toISOString().split('T')[0]}"`
        ).join('\n');
        
        const filename = `pelanggan_backup_${new Date().toISOString().replace(/:/g, '-')}.csv`;
        const filepath = path.join(backupDir, filename);
        
        fs.writeFileSync(filepath, csvHeader + csvRows, 'utf8');
        console.log(`Backup berhasil disimpan di ${filepath}`);
    } catch (error) {
        console.error('Backup otomatis gagal:', error);
    }
};

// Jalankan setiap hari pada pukul 02:00 pagi
cron.schedule('0 2 * * *', performBackup);

console.log('Scheduler backup otomatis dijalankan. Backup akan dibuat setiap hari pukul 02:00.');
