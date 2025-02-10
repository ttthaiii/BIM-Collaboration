const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const uploadController = require('../controllers/uploadController');
const userController = require('../controllers/userController');
const multer = require('multer');
const { pool } = require('../config/database');
const rfaController = require('../controllers/rfaController');

// Middleware ตรวจสอบตำแหน่งงาน
const checkJobPosition = async (req, res, next) => {
    if (!req.session.user?.jobPosition) {
        try {
            const [userData] = await pool.query(
                'SELECT job_position FROM users WHERE id = ?',
                [req.session.user.id]
            );
            
            if (userData.length > 0 && userData[0].job_position) {
                req.session.user.jobPosition = userData[0].job_position;
            } else {
                throw new Error('Job position not found');
            }
            next();
        } catch (error) {
            console.error('Error checking job position:', error);
            res.status(500).render('error', { 
                error: 'Unable to verify user position' 
            });
        }
    } else {
        next();
    }
};

// ตั้งค่า multer
const upload = multer({ 
    dest: 'uploads/'
});

// Authentication routes
router.get('/login', (req, res) => {
    res.render('login', { error: null });
});

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

        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role,
            jobPosition: user.job_position
        };

        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

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

// Dashboard routes
router.get('/dashboard', auth.isLoggedIn, auth.isUser, checkJobPosition, userController.getUserDocuments);
router.post('/upload-document', auth.isLoggedIn, auth.isUser, upload.single('document'), uploadController.uploadFile);

// RFA routes
router.get('/rfa', auth.isLoggedIn, auth.isUser, (req, res) => {
    res.render('rfa', { user: req.session.user });
});

router.get('/rfa/user-sites', auth.isLoggedIn, auth.isUser, rfaController.getUserSites);
router.get('/rfa/categories/:siteId', auth.isLoggedIn, auth.isUser, rfaController.getCategories);
router.get('/rfa/check-document', auth.isLoggedIn, auth.isUser, rfaController.checkExistingDocument);
router.post('/rfa/upload', auth.isLoggedIn, auth.isUser, upload.single('document'), rfaController.uploadRFADocument);

// RFI route
router.get('/rfi', auth.isLoggedIn, auth.isUser, (req, res) => {
    res.render('rfi', { user: req.session.user });
});

// Work Request route
router.get('/work-request', auth.isLoggedIn, auth.isUser, (req, res) => {
    res.render('workRequest', { user: req.session.user });
});

module.exports = router;