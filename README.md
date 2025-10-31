# Internet Billing System

Aplikasi billing internet full-stack yang dibuat dengan Node.js dan MongoDB.

## Fitur

- Manajemen Pelanggan
- Manajemen Paket Internet
- Pembuatan Tagihan Otomatis
- Tracking Pembayaran
- Monitoring PPOE Only, disable dan enable
- WABLAS
- user management (admin, staff)
- 

## Kebutuhan
- nodejs (version 20) (tested)
- mongodb version 4.4 (tested) 
## Instalasi
 
1. Clone repository
```bash
sudo git clone https://github.com/ganishpm/internet-billing-app.git
cd internet-billing-app 
```

2. Buat file .env
```
sudo nano .env
```
  isi file .env seperti dibawah ini
  ```
  NODE_ENV=production
  PORT=3004
  MONGODB_URI=mongodb://localhost:27017/internet_billing
  SESSION_SECRET=your_secret_key_here
  ```
  - ganti port sesuai keinginan anda 
  - Boleh ganti internet_billing karena itu nanti akan dipakai untuk nama database di mongodb.
    Jangan lupa sesuaikan port mongodb anda. port default = 27017
  - ganti your_secret_key_here dengan yang lain. sesuaikan dengan ingatan anda
    Fungsi utama dari SESSION_SECRET adalah sebagai kunci rahasia (secret key)
    yang digunakan untuk menandatangani (sign) cookie sesi atau ID sesi di aplikasi web,
    terutama di lingkungan Node.js dengan framework seperti Express.
4. Install Dependensi Proyek
```
sudo npm init -y
sudo npm install axios bcryptjs connect-flash connect-mongo csv-parser csv-writer dotenv ejs express express-session express-validator method-override moment mongoose multer node-cron node-routeros
```
5.  buat user Admin (bisa diganti sesuai keinginan anda)
Jika tidak ingin ganti bisa langsung jalankan
```
sudo node scripts/createAdmin.js
```
   Jika ingin ganti user admin. edit file dulu
   1) buka file createAdmin.js
      ```
      sudo nano scripts/createAdmin.js
      ```
   2) cara baris
      console.log('Username: admin');
      console.log('Password: admin123');
   3) ganti username dan pasword sesuai keinginan anda
   4) CTRL + X . klik Y dan enter
   5) Jalankan createAdmin.js
      ```
      sudo node scripts/createAdmin.js
      ```
6. jalankan aplikasi
```
npm start
```
