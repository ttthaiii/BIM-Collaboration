const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// Apply auth middleware to all admin routes
router.use(isLoggedIn);
router.use(isAdmin);

// Admin main routes
router.get('/', adminController.getAdminPage);
router.get('/dashboard', adminController.getAdminPage);

// User management routes
router.post('/add', adminController.addUser);
router.post('/delete', adminController.deleteUser);
router.get('/users/search', adminController.searchUsers);
router.post('/users/update', adminController.updateUser);

// Site management routes
router.post('/sites/add', adminController.addSite);
router.post('/sites/update', adminController.updateSite);
router.post('/sites/delete', adminController.deleteSite);

router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Failed to destroy session:", err);
      return res.status(500).send("Failed to logout");
    }
    res.clearCookie('connect.sid'); // ล้างคุกกี้
    res.redirect('/login'); // กลับไปหน้า Login
  });
});

module.exports = router;