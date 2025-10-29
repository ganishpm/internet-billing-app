module.exports = {
    ensureAdmin: (req, res, next) => {
        if (req.session.user && req.session.user.role === 'admin') {
            return next();
        }
        req.flash('error_msg', 'Anda tidak memiliki izin untuk mengakses halaman ini');
        res.redirect('/dashboard');
    }
};
