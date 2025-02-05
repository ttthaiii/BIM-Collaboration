const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// เส้นทางที่ต้องการการล็อกอินและสิทธิ์ Admin
router.get('/', isLoggedIn, isAdmin, adminController.getAdminPage);

// เพิ่มผู้ใช้ใหม่
router.post('/add', isLoggedIn, isAdmin, adminController.addUser);

// ลบผู้ใช้งาน
router.post('/delete', isLoggedIn, isAdmin, adminController.deleteUser);

// จัดการโครงการ
router.post('/sites/add', isLoggedIn, isAdmin, adminController.addSite);
router.post('/sites/update', isLoggedIn, isAdmin, adminController.updateSite);
router.post('/sites/delete', isLoggedIn, isAdmin, adminController.deleteSite);

// จัดการการอัปเดตผู้ใช้
router.post('/users/update', isLoggedIn, isAdmin, adminController.updateUser);

// ค้นหาผู้ใช้งาน
router.get('/users/search', isLoggedIn, isAdmin, adminController.searchUsers);

module.exports = router;
