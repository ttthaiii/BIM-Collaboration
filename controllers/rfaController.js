const fs = require('fs').promises;  // เพิ่มการ import fs
const { pool } = require('../config/database');
const driveService = require('../config/googleDrive');
const { uploadFile } = require('./uploadController');
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

exports.uploadRFADocument = async (req, res) => {
    let connection;
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log('Start uploading file to Google Drive...');

        // อัพโหลดไฟล์ไปยัง Google Drive
        const uploadResult = await driveService.uploadToDrive(
            req.session.user.id,
            req.file.path,
            req.file.originalname,
            req.file.mimetype
        );

        console.log('File uploaded to Drive:', uploadResult);

        // เริ่ม transaction
        connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // บันทึกข้อมูลในตาราง documents
            const [documentResult] = await connection.query(
                'INSERT INTO documents (user_id, file_name, file_url, google_file_id) VALUES (?, ?, ?, ?)',
                [
                    req.session.user.id,
                    req.file.originalname,
                    uploadResult.webViewLink,
                    uploadResult.id
                ]
            );

            // บันทึกข้อมูลในตาราง rfa_documents
            const { siteId, category, documentNumber } = req.body;
            await connection.query(
                'INSERT INTO rfa_documents (site_id, category_id, document_number, revision_number, document_id) VALUES (?, ?, ?, ?, ?)',
                [siteId, category, documentNumber, '00', documentResult.insertId]
            );

            await connection.commit();

            // ลบไฟล์ชั่วคราว
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error deleting temporary file:', unlinkError);
                // ไม่ throw error เพราะการลบไฟล์ชั่วคราวไม่ใช่ส่วนสำคัญ
            }

            return res.json({
                success: true,
                message: 'RFA document uploaded successfully',
                fileUrl: uploadResult.webViewLink
            });

        } catch (dbError) {
            await connection.rollback();
            throw dbError;
        }

    } catch (error) {
        console.error('RFA upload error:', error);

        // ลบไฟล์ชั่วคราวถ้ามี error
        if (req.file?.path) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error deleting temporary file:', unlinkError);
            }
        }

        // ส่ง error response ถ้ายังไม่ได้ส่ง response ไป
        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                error: 'Failed to upload RFA document',
                details: error.message
            });
        }

    } finally {
        // คืน connection กลับไปยัง pool
        if (connection) {
            connection.release();
        }
    }
};

// ดึงรายการโครงการที่ user มีสิทธิ์เข้าถึง
exports.getUserSites = async (req, res) => {
    try {
        // เพิ่มการตรวจสอบ session
        if (!req.session || !req.session.user) {
            console.log('No user session found');
            return res.status(401).json({ 
                success: false, 
                error: 'User not authenticated' 
            });
        }

        console.log('Session:', req.session);
        console.log('User ID:', req.session.user.id);

        // ดึงข้อมูลโครงการ
        const [sites] = await pool.query(`
            SELECT s.id, s.site_name 
            FROM sites s
            JOIN user_sites us ON s.id = us.site_id
            WHERE us.user_id = ?
        `, [req.session.user.id]);
        
        console.log('Sites found:', sites);

        // ตรวจสอบว่ามีข้อมูลหรือไม่
        if (!sites || sites.length === 0) {
            console.log('No sites found for user');
            return res.json({
                success: true,
                sites: []
            });
        }

        // ส่งข้อมูลกลับ
        return res.json({
            success: true,
            sites: sites.map(site => ({
                id: site.id,
                site_name: site.site_name
            }))
        });

    } catch (error) {
        console.error('Error in getUserSites:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch sites: ' + error.message 
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
        const { siteId, categoryId, documentNumber } = req.query;
        
        const [documents] = await pool.query(`
            SELECT r.revision_number, r.submission_date, d.file_url, 
                   u.username as submitter
            FROM rfa_documents r
            JOIN documents d ON r.document_id = d.id
            JOIN users u ON d.user_id = u.id
            WHERE r.site_id = ? 
            AND r.category_id = ? 
            AND r.document_number = ?
            ORDER BY r.revision_number DESC
        `, [siteId, categoryId, documentNumber]);
        
        res.json({ 
            success: true, 
            exists: documents.length > 0,
            documents 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
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