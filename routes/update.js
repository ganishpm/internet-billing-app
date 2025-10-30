const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const { ensureAuth } = require('../middleware/auth');
const { ensureAdmin } = require('../middleware/admin');
const util = require('util');

// Promisify exec untuk menggunakan async/await
const execPromise = util.promisify(exec);

// --- KONFIGURASI ---
// Ganti 'main' jika branch utama Anda bernama 'master'
const GIT_BRANCH = 'main'; 
const PROJECT_PATH = process.cwd(); // Akan otomatis mendapatkan path folder proyek

// !!! PENTING: Sesuaikan ini dengan cara Anda menjalankan aplikasi !!!
// Pilihan yang umum: 'npm start', 'npm run dev', atau 'node server.js'
const START_COMMAND = 'npm start'; 
// ------------------

/**
 * @route   POST /api/update
 * @desc    Menjalankan proses update aplikasi dari GitHub
 * @access  Private (Admin Only)
 */
router.post('/update', ensureAuth, ensureAdmin, async (req, res) => {
    console.log('[Update API] Permintaan update diterima dari admin:', req.user.username);

    try {
        // 1. Cari dan hentikan proses yang sedang berjalan
        console.log('[Update API] Mencari proses aplikasi yang sedang berjalan...');
        let pids = [];
        
        // Cari proses berdasarkan file utama (misal: server.js)
        // Ini akan menemukan proses yang dijalankan dengan `node server.js`
        const { stdout: stdoutNode } = await execPromise(`pgrep -f "node.*server.js"`).catch(() => ({ stdout: '' }));
        if (stdoutNode.trim()) {
            pids.push(...stdoutNode.trim().split('\n'));
        }

        // Jika tidak ditemukan, cari proses npm (untuk `npm start` atau `npm run dev`)
        if (pids.length === 0) {
            const { stdout: stdoutNpm } = await execPromise(`pgrep -f "npm.*start|npm.*dev"`).catch(() => ({ stdout: '' }));
            if (stdoutNpm.trim()) {
                pids.push(...stdoutNpm.trim().split('\n'));
            }
        }

        if (pids.length > 0) {
            console.log(`[Update API] Ditemukan ${pids.length} proses. Menghentikan proses...`);
            for (const pid of pids) {
                // Hentikan proses dengan SIGTERM (graceful shutdown)
                await execPromise(`kill ${pid}`);
                console.log(`[Update API] Proses dengan PID ${pid} telah dihentikan.`);
            }
            // Tunggu beberapa detik agar port benar-benar terbebas
            console.log('[Update API] Menunggu 3 detik agar port terbebas...');
            await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
            console.log('[Update API] Tidak ada proses aplikasi yang ditemukan. Melanjutkan update.');
        }

        // 2. Fetch perubahan terbaru dari remote
        console.log('[Update API] Menjalankan git fetch...');
        await execPromise(`git fetch origin`);
        console.log('[Update API] Git fetch selesai.');

        // 3. Reset ke versi terbaru di remote (aman, akan menimpa perubahan lokal)
        console.log(`[Update API] Melakukan reset ke versi terbaru di branch ${GIT_BRANCH}...`);
        await execPromise(`git reset --hard origin/${GIT_BRANCH}`);
        console.log('[Update API] Git reset selesai.');

        // 4. Install/update dependensi
        console.log('[Update API] Menginstall dependensi...');
        await execPromise('npm install');
        console.log('[Update API] npm install selesai.');

        // 5. Jalankan kembali aplikasi
        console.log(`[Update API] Menjalankan kembali aplikasi dengan perintah: ${START_COMMAND}`);
        // Gunakan nohup untuk memastikan aplikasi tetap berjalan di background
        // Log output akan disimpan ke file update.log
        await execPromise(`nohup ${START_COMMAND} > update.log 2>&1 &`);
        console.log('[Update API] Aplikasi berhasil dijalankan kembali di latar belakang. Log tersimpan di update.log');

        console.log('[Update API] Proses update berhasil!');
        res.json({ 
            success: true, 
            message: 'Aplikasi berhasil diperbarui! Halaman akan dimuat ulang dalam beberapa detik.' 
        });

    } catch (error) {
        console.error('[Update API] Gagal melakukan update:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal memperbarui aplikasi. Periksa log server untuk detailnya.' 
        });
    }
});

module.exports = router;
