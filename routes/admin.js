const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// ใช้ middleware ตรวจสอบการล็อกอินก่อน, แล้วค่อยตรวจสอบสิทธิ์ admin
router.use(isLoggedIn);
router.use(isAdmin);

router.get('/', adminController.getAdminPage);
router.post('/add', adminController.addUser);
router.post('/delete', adminController.deleteUser);
router.post("/sites/add", adminController.addSite);
router.post("/sites/update", adminController.updateSite);
router.post("/sites/delete", adminController.deleteSite);
router.post("/users/update", adminController.updateUser);
router.get("/users/search", adminController.searchUsers);

module.exports = router;

// 404 - Route Not Found
router.use((req, res) => {
    res.status(404).send('Route not found');
});

// 500 - Internal Server Error
router.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

