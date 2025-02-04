const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// เส้นทางที่ต้องการการล็อกอินและสิทธิ์ Admin
router.get('/', isLoggedIn, isAdmin, adminController.getAdminPage);
router.post('/add', isLoggedIn, isAdmin, adminController.addUser);
router.post('/delete', isLoggedIn, isAdmin, adminController.deleteUser);
router.post('/sites/add', isLoggedIn, isAdmin, adminController.addSite);
router.post('/sites/update', isLoggedIn, isAdmin, adminController.updateSite);
router.post('/sites/delete', isLoggedIn, isAdmin, adminController.deleteSite);
router.post('/users/update', isLoggedIn, isAdmin, adminController.updateUser);
router.get('/users/search', isLoggedIn, isAdmin, adminController.searchUsers);

// จัดการ 404 - Route Not Found
router.use((req, res) => {
  res.status(404).render('error', {
    message: 'Route not found',
    status: 404,
  });
});

// จัดการ 500 - Internal Server Error
router.use((err, req, res, next) => {
  console.error('Internal Server Error:', err.stack);
  res.status(500).render('error', {
    message: 'Something went wrong!',
    status: 500,
  });
});

module.exports = router;
