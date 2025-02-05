const express = require('express');
const router = express.Router();
const { poolPromise } = require('../config/database');

// Route แสดงหน้า Login
router.get('/login', (req, res) => {
  res.render('login', { errorMessage: null, username: null });
});

// Route จัดการ Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // ค้นหาผู้ใช้จากฐานข้อมูล
    const [users] = await poolPromise.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.render('login', {
        errorMessage: 'Invalid username or password.',
        username,
      });
    }

    const user = users[0];

    // เปรียบเทียบรหัสผ่านโดยตรง
    if (password !== user.password) {
      return res.render('login', {
        errorMessage: 'Invalid username or password.',
        username,
      });
    }

    // เก็บข้อมูลใน session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;

    // เปลี่ยนเส้นทางตามบทบาทผู้ใช้
    if (user.role === 'admin') {
      return res.redirect('/admin');
    } else {
      return res.redirect('/dashboard');
    }
  } catch (err) {
    console.error('Login error:', err);
    return res.render('login', {
      errorMessage: 'An error occurred. Please try again later.',
      username,
    });
  }
});

module.exports = router;
