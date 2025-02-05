const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// Apply middlewares
router.use(isLoggedIn);
router.use(isAdmin);

// Admin main routes
router.get('/', adminController.getAdminPage);
router.get('/dashboard', adminController.getAdminPage); // เพิ่ม route สำหรับ dashboard

// User management routes
router.post('/add', adminController.addUser);
router.post('/delete', adminController.deleteUser);
router.get('/users/search', adminController.searchUsers);
router.post('/users/update', adminController.updateUser);

// Site management routes
router.post('/sites/add', adminController.addSite);
router.post('/sites/update', adminController.updateSite);
router.post('/sites/delete', adminController.deleteSite);

module.exports = router;