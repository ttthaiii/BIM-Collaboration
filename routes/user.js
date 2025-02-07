const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const uploadController = require('../controllers/uploadController');
const userController = require('../controllers/userController');
const multer = require('multer');
const { pool } = require('../config/database'); // เปลี่ยนจาก poolPromise เป็น pool

// ตั้งค่า multer
const upload = multer({ 
  dest: 'uploads/'
});

// ลบ isLoggedIn และ isUser ที่ import แยก และใช้ auth แทน
router.use(auth.isLoggedIn);
router.use(auth.isUser);

// Route แสดงหน้า dashboard และ upload
router.get('/dashboard', userController.getUserDocuments);
router.post('/upload-document', upload.single('document'), uploadController.uploadFile);

// Route แสดงหน้า Login - ย้ายไปไว้ก่อน middleware
router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.get('/rfa', auth.isLoggedIn, auth.isUser, (req, res) => {
  res.render('rfa', { user: req.session.user });
});

router.get('/rfi', auth.isLoggedIn, auth.isUser, (req, res) => {
  res.render('rfi', { user: req.session.user });
});

router.get('/work-request', auth.isLoggedIn, auth.isUser, (req, res) => {
  res.render('workRequest', { user: req.session.user });
});

// Route จัดการ Login - ย้ายไปไว้ก่อน middleware
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE username = ? LIMIT 1',
      [username]
    );

    if (users.length === 0 || password !== users[0].password) {
      return res.json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    const user = users[0];

    // เก็บข้อมูลใน session
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };

    // บันทึก session
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // ส่ง response กลับไปยัง client
    res.json({
      success: true,
      redirectUrl: user.role === 'admin' ? '/admin' : '/user/dashboard'
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      error: 'Server error occurred'
    });
  }
});

module.exports = router;