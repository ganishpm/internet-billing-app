module.exports = {
  apps: [{
    name: 'internet-billing-app',
    script: 'server.js',
    instances: 1, // Jumlah instance yang dijalankan
    autorestart: true, // Restart otomatis jika crash
    watch: false, // Tidak perlu watch di produksi
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // Definisikan background processes
    interpreter_args: [],
    node_args: [],
    // Menjalankan scheduler dan backup sebagai bagian dari aplikasi
    post_setup: [{
      command: 'node scheduler.js',
      wait_for: 1000 // Tunggu 1 detik sebelum menjalankan command berikutnya
    }, {
      command: 'node backup.js',
      wait_for: 1000
    }]
  }]
};
