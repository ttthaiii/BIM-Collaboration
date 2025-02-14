const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const uploadController = require('../controllers/uploadController');
const userController = require('../controllers/userController');
const multer = require('multer');
const { pool } = require('../config/database');
const rfaController = require('../controllers/rfaController');
const RFA_AUTHORIZED_POSITIONS = ['BIM', 'Adminsite', 'OE', 'CM'];
const adminRfaController = require('../controllers/adminRfaController');

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
    
    if (!position) {
        return res.status(403).render('error', { 
            error: 'ไม่พบข้อมูลตำแหน่งงาน' 
        });
    }

    if (!RFA_AUTHORIZED_POSITIONS.includes(position)) {
        return res.status(403).render('error', { 
            error: 'ตำแหน่งงานของคุณไม่มีสิทธิ์เข้าถึงระบบ RFA' 
        });
    }

    // แก้ไขตรงนี้: กำหนด template และสถานะที่อนุญาต
    if (position === 'BIM') {
        req.rfaView = 'rfa-bim';
    } else {
        // ทุกตำแหน่งที่ไม่ใช่ BIM จะใช้ template เดียวกัน
        req.rfaView = 'rfa-admin-template';
        
        // กำหนดสถานะที่อนุญาตตามตำแหน่ง
        switch(position) {
            case 'Adminsite':
                req.availableStatuses = ['ส่ง CM', 'แก้ไข'];
                req.documentFilter = ['BIM ส่งแบบ'];
                break;
            case 'Adminsite2':
                req.availableStatuses = [
                    'ส่ง CM', 'แก้ไข', 'อนุมัติ',
                    'อนุมัติตามคอมเมนต์ (ไม่ต้องแก้ไข)',
                    'อนุมัติตามคอมเมนต์ (ต้องแก้ไข)', 
                    'ไม่อนุมัติ'
                ];
                req.documentFilter = ['BIM ส่งแบบ', 'ส่ง CM'];
                break;
            case 'CM':
                req.availableStatuses = [
                    'อนุมัติ',
                    'อนุมัติตามคอมเมนต์ (ไม่ต้องแก้ไข)',
                    'อนุมัติตามคอมเมนต์ (ต้องแก้ไข)',
                    'ไม่อนุมัติ'
                ];
                req.documentFilter = ['ส่ง CM'];
                break;
        }
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
    checkRFAAccess,
    (req, res) => {
        // ส่งข้อมูลเพิ่มเติมไปให้ template
        res.render(req.rfaView, { 
            user: req.session.user,
            availableStatuses: req.availableStatuses || [],
            documentFilter: req.documentFilter || []
        });
    }
);

router.get('/rfa/user-sites', 
    auth.isLoggedIn, 
    auth.isUser, 
    checkRFAAccess, 
    rfaController.getUserSites  // คงไว้ใน rfaController เพราะใช้ร่วมกัน
);

router.get('/rfa/categories/:siteId', 
    auth.isLoggedIn, 
    auth.isUser, 
    checkJobPosition,
    checkRFAAccess,
    rfaController.getCategories  // คงไว้ใน rfaController เพราะใช้ร่วมกัน
);

router.get('/rfa/check-document', 
    auth.isLoggedIn, 
    auth.isUser, 
    checkJobPosition,
    checkRFAAccess,
    (req, res, next) => {
        if (req.session.user.jobPosition === 'BIM') {
            return rfaController.checkExistingDocument(req, res, next);
        }
        next();
    }
);

router.post('/rfa/upload',
    auth.isLoggedIn,
    auth.isUser,
    checkJobPosition,
    checkRFAAccess,
    upload.single('document'),
    (req, res, next) => {
        if (req.session.user.jobPosition === 'BIM') {
            return rfaController.uploadRFADocument(req, res, next);
        }
        next();
    }
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

router.get('/rfa/documents',
    auth.isLoggedIn,
    auth.isUser,
    checkRFAAccess,
    (req, res, next) => {
        if (['Adminsite', 'Adminsite2', 'CM'].includes(req.session.user.jobPosition)) {
            return adminRfaController.getDocumentsByPosition(req, res, next);
        }
        next();
    }
);

router.get('/rfa/search',
    auth.isLoggedIn,
    auth.isUser,
    checkRFAAccess,
    (req, res, next) => {
        if (['Adminsite', 'Adminsite2', 'CM'].includes(req.session.user.jobPosition)) {
            return adminRfaController.searchDocuments(req, res, next);
        }
        next();
    }
);

router.post('/rfa/update-status',
    auth.isLoggedIn,
    auth.isUser,
    checkRFAAccess,
    upload.single('document'),
    (req, res, next) => {
        if (['Adminsite', 'Adminsite2', 'CM'].includes(req.session.user.jobPosition)) {
            return adminRfaController.updateDocumentStatus(req, res, next);
        }
        next();
    }
);

module.exports = router;