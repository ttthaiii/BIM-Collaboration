// ตรวจสอบการล็อกอิน
const isLoggedIn = (req, res, next) => {
  console.log('Checking login status:', req.session?.user);
  if (req.session && req.session.user) {
      next();
  } else {
      res.redirect('/login');
  }
};

// ตรวจสอบสิทธิ์ Admin
const isAdmin = (req, res, next) => {
  console.log('Checking admin rights:', req.session?.user);
  if (req.session?.user?.role === 'admin') {
      next();
  } else {
      res.status(403).render('error', {
          message: 'Access Denied',
          error: { 
              status: 403,
              stack: 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้' 
          }
      });
  }
};

// ตรวจสอบสิทธิ์ User
const isUser = (req, res, next) => {
  console.log('Checking user rights:', req.session?.user);
  if (req.session?.user?.role === 'user') {
      next();
  } else {
      res.status(403).render('error', {
          message: 'Access Denied',
          error: { 
              status: 403,
              stack: 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้' 
          }
      });
  }
};

const authMiddleware = {
  isLoggedIn: (req, res, next) => {
    if (req.session && req.session.userId) {
      next(); // ผู้ใช้งานยังล็อกอินอยู่
    } else {
      res.redirect('/login'); // บังคับไปหน้า Login ถ้าเซสชันหมดอายุ
    }
  },
  isAdmin: (req, res, next) => {
    if (req.session && req.session.role === 'admin') {
      next(); // ผู้ใช้งานมีสิทธิ์ Admin
    } else {
      res.status(403).send('Access Denied: Admin privileges required');
    }
  },
};

module.exports = {
  isLoggedIn,
  isAdmin,
  isUser,
  authMiddleware
};