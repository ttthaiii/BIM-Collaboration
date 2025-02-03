const express = require('express');
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
      
      const [users] = await poolPromise.query(
        'SELECT * FROM users WHERE username = ? AND password = ?',
        [username, password]
      );
  
      if (users.length > 0) {
        const user = users[0];
        // เก็บข้อมูลใน session ให้ครบ
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;
        req.session.isLoggedIn = true;  // เพิ่ม flag นี้
        
        console.log('Session after login:', req.session); // เพิ่ม log
  
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