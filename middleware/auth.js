// ตรวจสอบการล็อกอิน
const isLoggedIn = (req, res, next) => {
  // ตรวจสอบว่ามี session และ user หรือไม่
  if (!req.session || !req.session.user) {
    console.log('No session or user found');
    return res.redirect('/login');
  }

  // ตรวจสอบเวลาที่ไม่ได้ใช้งาน
  const currentTime = Date.now();
  const lastAccess = req.session.lastAccess || currentTime;
  const inactiveTime = currentTime - lastAccess;

  // ถ้าไม่ได้ใช้งานเกิน 30 นาที
  if (inactiveTime > 30 * 60 * 1000) {
    console.log('Session timeout due to inactivity');
    return req.session.destroy(() => {
      res.clearCookie('sessionId');
      res.redirect('/login');
    });
  }

  // อัพเดทเวลาเข้าใช้งานล่าสุด
  req.session.lastAccess = currentTime;

  // ตรวจสอบการเปิดแท็บใหม่เฉพาะเมื่อมีการเปลี่ยนหน้า
  if (req.get('sec-fetch-dest') === 'document' && req.method === 'GET') {
    const referrer = req.get('referer') || '';
    const host = req.get('host');
    
    // ถ้าไม่มี referrer หรือมาจากโดเมนอื่น (เปิดแท็บใหม่)
    if (!referrer.includes(host)) {
      console.log('New tab detected, clearing session');
      return req.session.destroy(() => {
        res.clearCookie('sessionId');
        res.redirect('/login');
      });
    }
  }

  next();
};


// ตรวจสอบสิทธิ์ Admin
const isAdmin = (req, res, next) => {
  if (req.session.user?.role === 'admin') {
      return next(); // อนุญาตให้เข้าถึง
  }
  res.redirect('/admin'); // Redirect ไปยังหน้า Admin Menu
};


// ตรวจสอบสิทธิ์ User
const isUser = (req, res, next) => {
  if (!req.session.user) {
      return res.redirect('/login');
  }
  if (req.session.user.role !== 'user') {
      return res.status(403).render('error', {
          message: 'Access denied',
          error: { status: 403 }
      });
  }
  next();
};

module.exports = {
  isLoggedIn,
  isAdmin,
  isUser
};