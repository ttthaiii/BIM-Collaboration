// ตรวจสอบการล็อกอิน
const isLoggedIn = (req, res, next) => {
  console.log('Checking login status:', req.session?.user);

  if (req.session && req.session.user) {
    if (!req.session.sessionID) {
      req.session.sessionID = req.sessionID;
    } else if (req.session.sessionID !== req.sessionID) {
      req.session.destroy(() => {
        res.redirect('/login');
      });
      return;
    }
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

module.exports = {
  isLoggedIn,
  isAdmin,
  isUser
};