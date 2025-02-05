const authMiddleware = {
  // ตรวจสอบว่าผู้ใช้งานล็อกอินแล้วหรือยัง
  isLoggedIn: (req, res, next) => {
    if (req.session && req.session.userId) {
      next();
    } else {
      res.redirect('/login');
    }
  },

  // ตรวจสอบสิทธิ์ Admin
  isAdmin: (req, res, next) => {
    if (req.session && req.session.role === 'admin') {
      next();
    } else {
      res.status(403).send('Access Denied: Admin privileges required.');
    }
  },
};

module.exports = authMiddleware;
