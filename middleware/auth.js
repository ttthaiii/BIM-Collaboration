const authMiddleware = {
    // ตรวจสอบการล็อกอิน
    isLoggedIn: (req, res, next) => {
      if (req.session && req.session.userId) {
        next();
      } else {
        res.redirect('/login');
      }
    },
  
    // ตรวจสอบสิทธิ์ Admin
    isAdmin: (req, res, next) => {
      console.log('Session:', req.session); // เพิ่ม log เพื่อดูค่า session
      if (req.session && req.session.role === 'admin') {
        next();
      } else {
        res.status(403).send('Access Denied: Admin privileges required');
      }
    }
  };
  
  module.exports = authMiddleware;