const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// ใส่ middleware ทั้ง isLoggedIn และ isAdmin สำหรับทุก route
router.use(isLoggedIn, isAdmin);

// หน้า Admin
router.get('/', adminController.getAdminPage);

// จัดการผู้ใช้
router.post('/users/add', adminController.addUser);
router.post('/users/update', adminController.updateUser);
router.post('/users/delete', adminController.deleteUser);
router.get('/users/search', adminController.searchUsers);

// จัดการโครงการ
router.post('/sites/add', adminController.addSite);
router.post('/sites/update', adminController.updateSite);
router.post('/sites/delete', adminController.deleteSite);

module.exports = router;