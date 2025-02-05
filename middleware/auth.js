// ตรวจสอบการล็อกอิน
const isLoggedIn = (req, res, next) => {
  if (req.session && req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
};

// ตรวจสอบสิทธิ์ Admin
const isAdmin = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.status(403).render('error', {
      message: 'Access Denied',
      error: { status: 403, stack: 'You do not have permission to access this page' }
    });
  }
};

module.exports = {
  isLoggedIn,
  isAdmin
};