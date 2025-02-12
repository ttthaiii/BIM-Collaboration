const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const uploadController = require('../controllers/uploadController');
const userController = require('../controllers/userController');
const multer = require('multer');
const { pool } = require('../config/database');
const rfaController = require('../controllers/rfaController');
const RFA_AUTHORIZED_POSITIONS = ['BIM', 'Adminsite', 'OE', 'CM'];

const upload = multer({ 
    dest: 'uploads/'
});

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

// เพิ่ม middleware สำหรับตรวจสอบตำแหน่งงาน
const checkRFAAccess = (req, res, next) => {
    const position = req.session.user?.jobPosition;
    
    // ตรวจสอบว่ามีข้อมูลตำแหน่งหรือไม่
    if (!position) {
        return res.status(403).render('error', { 
            error: 'ไม่พบข้อมูลตำแหน่งงาน' 
        });
    }

    // ตรวจสอบว่าตำแหน่งมีสิทธิ์เข้าถึงหรือไม่
    if (!RFA_AUTHORIZED_POSITIONS.includes(position)) {
        return res.status(403).render('error', { 
            error: 'ตำแหน่งงานของคุณไม่มีสิทธิ์เข้าถึงระบบ RFA' 
        });
    }

    // กำหนด view ตามตำแหน่งงาน
    if (position === 'BIM') {
        req.rfaView = 'rfa-bim';
    } else if (['Adminsite', 'OE'].includes(position)) {
        req.rfaView = 'rfa-site';
    } else if (position === 'CM') {
        req.rfaView = 'rfa-cm';
    }
    
    next();
};

// Dashboard routes
router.get('/dashboard', 
    auth.isLoggedIn, 
    auth.isUser, 
    checkJobPosition, 
    userController.getUserDocuments
);

router.post('/upload-document', 
    auth.isLoggedIn, 
    auth.isUser, 
    checkJobPosition,
    upload.single('document'), 
    uploadController.uploadFile
);

// RFA routes
router.get('/rfa', 
    auth.isLoggedIn, 
    auth.isUser, 
    checkRFAAccess,  // ใช้เพียง middleware เดียว
    (req, res) => {
        res.render(req.rfaView, { user: req.session.user });
    }
);

router.get('/rfa/user-sites', 
    auth.isLoggedIn, 
    auth.isUser, 
    checkRFAAccess, 
    rfaController.getUserSites
);
router.get('/rfa/categories/:siteId', 
    auth.isLoggedIn, 
    auth.isUser, 
    checkJobPosition,
    checkRFAAccess,
    rfaController.getCategories
);
router.get('/rfa/check-document', 
    auth.isLoggedIn, 
    auth.isUser, 
    checkJobPosition,
    checkRFAAccess,
    rfaController.checkExistingDocument
);

router.post('/rfa/upload',
    auth.isLoggedIn,
    auth.isUser,
    checkJobPosition,
    checkRFAAccess,
    upload.single('document'),
    rfaController.uploadRFADocument
);

// RFI route
router.get('/rfi', 
    auth.isLoggedIn, 
    auth.isUser, 
    checkJobPosition,
    (req, res) => {
        res.render('rfi', { user: req.session.user });
    }
);

// Work Request route
router.get('/work-request', 
    auth.isLoggedIn, 
    auth.isUser, 
    checkJobPosition,
    (req, res) => {
        res.render('workRequest', { user: req.session.user });
    }
);

module.exports = router;