const express = require('express');
const bcrypt = require('bcrypt'); // สำหรับเข้ารหัสรหัสผ่าน
const router = express.Router();
const { poolPromise } = require('../config/database');

// แสดงหน้า login
router.get('/login', (req, res) => {
  res.render('login', { error: undefined });
});

// จัดการการ login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // ตรวจสอบข้อมูลในฐานข้อมูล
    const [users] = await poolPromise.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length > 0) {
      const user = users[0];

      // ตรวจสอบรหัสผ่าน
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.render('login', { error: 'Invalid credentials' });
      }

      // เก็บข้อมูลใน session
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      req.session.isLoggedIn = true;

      console.log('Session after login:', req.session); // Debugging log

      // เปลี่ยนเส้นทางตามบทบาทของผู้ใช้งาน
      if (user.role === 'admin') {
        return res.redirect('/admin');
      } else {
        return res.redirect('/user');
      }
    } else {
      return res.render('login', { error: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Login error:', err);
    return res.render('login', { error: 'An error occurred' });
  }
});

module.exports = router;
