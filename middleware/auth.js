const authMiddleware = {
  // ตรวจสอบการล็อกอิน
  isLoggedIn: (req, res, next) => {
    if (req.session && req.session.userId) {
      next();
    } else {
      console.warn('Unauthorized access attempt: User not logged in');
      res.redirect('/login');
    }
  },

  // ตรวจสอบสิทธิ์ Admin
  isAdmin: (req, res, next) => {
    console.log('Session:', req.session); // เพิ่ม log เพื่อดูค่า session
    if (req.session && req.session.role === 'admin') {
      next();
    } else {
      console.warn(
        `Access denied for user ${
          req.session && req.session.username
        }: Admin privileges required`
      );
      res.status(403).send('Access Denied: You do not have admin privileges');
    }
  },
};

module.exports = authMiddleware;
