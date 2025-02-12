const fs = require('fs').promises;  // เพิ่มการ import fs
const { pool } = require('../config/database');
const driveService = require('../config/googleDrive');
const { uploadFile } = require('./uploadController');

const checkRFAPermission = (jobPosition) => {
    const authorizedPositions = ['BIM', 'Adminsite', 'OE', 'CM'];
    return authorizedPositions.includes(jobPosition);
};

const getCategoryId = async (connection, categoryCode, siteId) => {
    try {
        // เพิ่ม logging เพื่อตรวจสอบค่าที่ส่งมา
        console.log('Searching for category:', { categoryCode, siteId });

        // ตรวจสอบว่าค่าที่ส่งมาถูกต้อง
        if (!categoryCode || !siteId) {
            console.error('Missing required parameters');
            return null;
        }

        // ใช้ parameterized query ที่ถูกต้อง
        const [rows] = await connection.query(
            'SELECT id FROM work_categories WHERE category_code = ? AND site_id = ? AND active = true LIMIT 1',
            [categoryCode, siteId]
        );

        // เพิ่ม logging ผลลัพธ์
        console.log('Query result:', rows);

        if (!rows || rows.length === 0) {
            console.log('No category found');
            return null;
        }

        return rows[0].id;
    } catch (error) {
        console.error('Error in getCategoryId:', error);
        throw error;
    }
};

// เพิ่มฟังก์ชันสำหรับการเรียกดูข้อมูลตามบทบาท
exports.getBIMView = async (req, res) => {
    try {
        // ตรวจสอบสิทธิ์และดึงข้อมูลเฉพาะสำหรับ BIM
        const data = await getBIMSpecificData(req.session.user.id);
        res.render('rfa-bim', { user: req.session.user, data });
    } catch (error) {
        console.error('Error in getBIMView:', error);
        res.status(500).render('error', { error });
    }
};

exports.getSiteView = async (req, res) => {
    try {
        // ตรวจสอบสิทธิ์และดึงข้อมูลเฉพาะสำหรับ Site
        const data = await getSiteSpecificData(req.session.user.id);
        res.render('rfa-site', { user: req.session.user, data });
    } catch (error) {
        console.error('Error in getSiteView:', error);
        res.status(500).render('error', { error });
    }
};

exports.getCMView = async (req, res) => {
    try {
        // ตรวจสอบสิทธิ์และดึงข้อมูลเฉพาะสำหรับ CM
        const data = await getCMSpecificData(req.session.user.id);
        res.render('rfa-cm', { user: req.session.user, data });
    } catch (error) {
        console.error('Error in getCMView:', error);
        res.status(500).render('error', { error });
    }
};

exports.uploadRFADocument = async (req, res) => {
    let connection;
    try {
        
        if (!checkRFAPermission(req.session.user.jobPosition)) {
            return res.status(403).json({ 
                success: false, 
                error: 'ไม่มีสิทธิ์ในการอัพโหลดเอกสาร RFA' 
            });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Convert filename to UTF-8
        const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

        // Get category ID
        const [categoryResult] = await pool.query(
            'SELECT id FROM work_categories WHERE category_code = ? AND site_id = ? AND active = true',
            [req.body.category, req.body.siteId]
        );

        if (!categoryResult.length) {
            throw new Error('Category not found');
        }

        const categoryId = categoryResult[0].id;

        // Upload to Google Drive
        const uploadResult = await driveService.uploadToDrive(
            req.session.user.id,
            req.file.path,
            fileName,
            req.file.mimetype
        );

        // Start database transaction
        connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Insert document
            const [documentResult] = await connection.query(
                'INSERT INTO documents (user_id, file_name, file_url, google_file_id) VALUES (?, ?, ?, ?)',
                [
                    req.session.user.id,
                    fileName,
                    uploadResult.webViewLink,
                    uploadResult.id
                ]
            );

            // Insert RFA document
            await connection.query(
                `INSERT INTO rfa_documents 
                (site_id, category_id, document_number, revision_number, document_id, created_by) 
                VALUES (?, ?, ?, '00', ?, ?)`,
                [
                    req.body.siteId,
                    categoryId,
                    req.body.documentNumber,
                    documentResult.insertId,
                    req.session.user.id
                ]
            );

            await connection.commit();
            
            return res.json({
                success: true,
                message: 'Upload successful',
                fileUrl: uploadResult.webViewLink
            });

        } catch (dbError) {
            await connection.rollback();
            throw dbError;
        }

    } catch (error) {
        console.error('Upload error:', error);
        
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(console.error);
        }
        
        return res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (connection) connection.release();
    }
};


// ดึงรายการโครงการที่ user มีสิทธิ์เข้าถึง
exports.getUserSites = async (req, res) => {
    try {
        const [sites] = await pool.query(`
            SELECT DISTINCT s.id, s.site_name 
            FROM sites s
            INNER JOIN user_sites us ON s.id = us.site_id
            WHERE us.user_id = ?
            ORDER BY s.site_name ASC
        `, [req.session.user.id]);

        res.json({
            success: true,
            sites: sites
        });
    } catch (error) {
        console.error('Error getting user sites:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ดึงหมวดงานตามโครงการ
exports.getCategories = async (req, res) => {
    try {
        const { siteId } = req.params;
        console.log('Getting categories for site:', siteId);

        const [categories] = await pool.query(`
            SELECT id, category_name 
            FROM work_categories 
            WHERE site_id = ?
        `, [siteId]);
        
        console.log('Categories found:', categories);
        return res.json({ 
            success: true, 
            categories: categories || [] 
        });

    } catch (error) {
        console.error('Error in getCategories:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};

// ตรวจสอบเอกสารซ้ำ
exports.checkExistingDocument = async (req, res) => {
    try {

        if (!checkRFAPermission(req.session.user.jobPosition)) {
            return res.status(403).json({ 
                success: false, 
                error: 'ไม่มีสิทธิ์ในการตรวจสอบเอกสาร RFA' 
            });
        }

        const { siteId, category, documentNumber } = req.query;
        
        console.log('Checking document:', { siteId, category, documentNumber });

        // 1. หา category_id จาก category_code
        const [categoryResult] = await pool.query(`
            SELECT id 
            FROM work_categories 
            WHERE category_code = ? 
            AND site_id = ?
            AND active = true
        `, [category, siteId]);

        if (!categoryResult.length) {
            console.log('Category not found:', category);
            return res.json({
                success: true,
                exists: false,
                documents: []
            });
        }

        const categoryId = categoryResult[0].id;

        // 2. ค้นหาเอกสาร RFA
        const [documents] = await pool.query(`
            SELECT 
                r.document_number,
                r.revision_number,
                DATE_FORMAT(r.created_at, '%d/%m/%Y') as submission_date,
                d.file_url,
                u.username as submitter,
                wc.category_name,
                s.site_name
            FROM rfa_documents r
            JOIN documents d ON r.document_id = d.id
            JOIN users u ON r.created_by = u.id
            JOIN work_categories wc ON r.category_id = wc.id
            JOIN sites s ON r.site_id = s.id
            WHERE r.site_id = ? 
            AND r.category_id = ?
            AND r.document_number = ?
            ORDER BY r.revision_number DESC
        `, [siteId, categoryId, documentNumber]);

        console.log('Documents found:', documents);
        
        res.json({ 
            success: true, 
            exists: documents.length > 0,
            documents 
        });

    } catch (error) {
        console.error('Error in checkExistingDocument:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};

// บันทึกเอกสาร RFA
exports.saveDocument = async (req, res) => {
    try {
        const { siteId, categoryId, documentNumber, fileUrl, googleFileId } = req.body;
        
        await pool.query(`
            INSERT INTO rfa_documents 
            (site_id, category_id, document_number, revision_number, file_url, google_file_id, user_id)
            VALUES (?, ?, ?, '00', ?, ?, ?)
        `, [siteId, categoryId, documentNumber, fileUrl, googleFileId, req.session.user.id]);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.addCategory = async (req, res) => {
    try {
        const { siteId, categoryName } = req.body;
        await pool.query(
            'INSERT INTO work_categories (site_id, category_name) VALUES (?, ?)',
            [siteId, categoryName]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// rfaController.js
exports.getDocumentHistory = async (req, res) => {
    try {
        const [documents] = await pool.query(`
            SELECT 
                r.document_number,
                r.revision_number,
                r.submission_date,
                d.file_name,
                d.file_url,
                s.site_name,
                wc.category_name,
                u.username as submitter
            FROM rfa_documents r
            JOIN documents d ON r.document_id = d.id
            JOIN sites s ON r.site_id = s.id
            JOIN work_categories wc ON r.category_id = wc.id
            JOIN users u ON d.user_id = u.id
            WHERE d.user_id = ?
            ORDER BY r.submission_date DESC
        `, [req.session.user.id]);

        res.render('rfa-history', { documents });
    } catch (error) {
        console.error('Error fetching document history:', error);
        res.status(500).render('error', { error });
    }
};