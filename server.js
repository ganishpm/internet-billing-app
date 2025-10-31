const express = require('express');
const mongoose = require('mongoose');
mongoose.set('strictQuery', false); 
const session = require('express-session');
const MongoStore = require('connect-mongo');
const methodOverride = require('method-override');
const path = require('path');
const moment = require('moment');
const flash = require('connect-flash');
const { ensureAuth } = require('./middleware/auth');
const { ensureAdmin } = require('./middleware/admin');
const Setting = require('./models/Setting');
const RouterOS = require('node-routeros').RouterOS;
const axios = require('axios');
const scheduler = require('./scheduler'); 
require('dotenv').config();

const app = express();

// Make moment available in all views
app.locals.moment = moment;

// Database Connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB Connected');
    scheduler.startScheduler(); //Jalankan scheduler setelah koneksi DB berhasil
}).catch(err => {
    console.log(err);
});



// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method'));

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI
    })
}));

// Flash Messages Middleware (harus setelah session)
app.use(flash());

// Global variables for flash messages and settings
app.use(async (req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    
    // Ambil setting dan buat global
    let settings = await Setting.findOne();
    if (!settings) {
        settings = await Setting.create({});
    }
    res.locals.settings = settings;

    next();
});
// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/customers', require('./routes/customers'));
app.use('/packages', require('./routes/packages'));
app.use('/invoices', require('./routes/invoices'));
app.use('/payments', require('./routes/payments'));
app.use('/settings', require('./routes/settings'));
app.use('/pppoe', require('./routes/pppoe'));
app.use('/broadcast', require('./routes/broadcast'));

// Home Route
app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/login');
    }
});

// 404 Handler
app.use((req, res) => {
    res.status(404).render('404', { title: 'Halaman Tidak Ditemukan' });
});

// --- API Test Connection Routes ---
app.post('/settings/test-mikrotik', ensureAuth, ensureAdmin, async (req, res) => {
    const { host, port, user, pass } = req.body;
    if (!host || !user || !pass) {
        return res.json({ success: false, message: 'Host, Username, dan Password wajib diisi.' });
    }
    try {
        const conn = new RouterOS({
            host: host,
            port: port || 8728,
            user: user,
            password: pass,
            timeout: 5000 // 5 detik timeout
        });
        // Coba koneksi dan ambil data sederhana
        await conn.connect();
        const data = await conn.write('/system/resource/print');
        await conn.close();
        res.json({ success: true, message: 'Koneksi ke Mikrotik berhasil!' });
    } catch (error) {
        console.error('Mikrotik connection error:', error);
        res.json({ success: false, message: `Gagal terhubung: ${error.message}` });
    }
});

app.post('/settings/test-wablas', ensureAuth, ensureAdmin, async (req, res) => {
    const { apiUrl, apiKey } = req.body;
    if (!apiUrl || !apiKey) {
        return res.json({ success: false, message: 'API URL dan API Key wajib diisi.' });
    }
    try {
        const response = await axios.get(`${apiUrl}/api/v2/device`, {
            headers: {
                'Authorization': `${apiKey}`
            },
            timeout: 5000 // 5 detik timeout
        });
        // Jika status 200, berarti API Key valid
        if (response.data.status === true) {
            res.json({ success: true, message: 'API Key WaBlas valid!' });
        } else {
            res.json({ success: false, message: `API Key tidak valid: ${response.data.message}` });
        }
    } catch (error) {
        console.error('WaBlas connection error:', error);
        if (error.response) {
            res.json({ success: false, message: `Gagal: ${error.response.data.message}` });
        } else {
            res.json({ success: false, message: `Gagal terhubung: ${error.message}` });
        }
    }
});

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
