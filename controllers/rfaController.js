const fs = require('fs').promises;  // เพิ่มการ import fs
const { pool } = require('../config/database');
const driveService = require('../config/googleDrive');
const { uploadFile } = require('./uploadController');

async function logUpload(connection, {userId, documentId = null, rfaDocumentId = null, status, error = null}) {
    try {
        // บันทึกลงในตาราง upload_logs
        await connection.query(
            `INSERT INTO upload_logs 
            (user_id, document_id, rfa_document_id, status, error_message) 
            VALUES (?, ?, ?, ?, ?)`,
            [userId, documentId, rfaDocumentId, status, error]
        );
        
        console.log('Log saved:', {
            userId,
            documentId,
            rfaDocumentId,
            status,
            error
        });
    } catch (logError) {
        console.error('Error logging upload:', logError);
        // ไม่ throw error เพราะไม่อยากให้ error ของ log ทำให้ transaction หลักล้มเหลว
    }
}

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

exports.uploadRFADocument = async (req, res) => {
    let connection;
    try {
        // Log ข้อมูลที่ได้รับจาก request
        console.log('Received request data:', {
            siteId: req.body.siteId,
            category: req.body.category,
            documentNumber: req.body.documentNumber,
            hasFile: !!req.file
        });

        // 1. ตรวจสอบสิทธิ์
        if (!checkRFAPermission(req.session.user.jobPosition)) {
            throw new Error('ไม่มีสิทธิ์ในการอัพโหลดเอกสาร RFA');
        }

        // 2. ตรวจสอบไฟล์
        if (!req.file) {
            throw new Error('กรุณาเลือกไฟล์');
        }

        // 3. แปลงชื่อไฟล์เป็น UTF-8
        const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        console.log('File name:', fileName);

        // 4. เริ่ม Transaction
        connection = await pool.getConnection();
        await connection.beginTransaction();
        console.log('Transaction started');

        // 5. ดึง category ID
        const categoryId = await getCategoryId(connection, req.body.category, req.body.siteId);
        if (!categoryId) {
            throw new Error('ไม่พบหมวดงาน');
        }
        console.log('Category ID:', categoryId);

        // 6. ตรวจสอบเอกสารซ้ำ
        const [existingDoc] = await connection.query(
            `SELECT id, status FROM rfa_documents 
             WHERE site_id = ? 
             AND category_id = ? 
             AND document_number = ? 
             AND revision_number = ?`,
            [req.body.siteId, categoryId, req.body.documentNumber, '00']
        );

        if (existingDoc.length > 0) {
            throw new Error(`เอกสารนี้มีอยู่ในระบบแล้ว (สถานะ: ${existingDoc[0].status})`);
        }

        // 7. อัพโหลดไฟล์ไป Google Drive
        console.log('Uploading to Google Drive...');
        const uploadResult = await driveService.uploadToDrive(
            req.session.user.id,
            req.file.path,
            fileName,
            req.file.mimetype
        );
        console.log('Upload result:', uploadResult);

        // 8. บันทึกข้อมูลในตาราง documents
        console.log('Saving document to database...');
        const [documentResult] = await connection.query(
            `INSERT INTO documents 
             (user_id, file_name, file_url, google_file_id) 
             VALUES (?, ?, ?, ?)`,
            [
                req.session.user.id,
                fileName,
                uploadResult.webViewLink,
                uploadResult.id
            ]
        );
        console.log('Document saved:', documentResult);

        // 9. บันทึกข้อมูลในตาราง rfa_documents
        console.log('Saving RFA document...');
        const [rfaResult] = await connection.query(
            `INSERT INTO rfa_documents 
             (site_id, category_id, document_number, revision_number, document_id, created_by, status, title) 
             VALUES (?, ?, ?, '00', ?, ?, 'BIM ส่งแบบ', ?)`,
            [
                req.body.siteId,
                categoryId,
                req.body.documentNumber,
                documentResult.insertId,
                req.session.user.id,
                req.body.documentName || fileName
            ]
        );
        console.log('RFA document saved:', rfaResult);

        // 10. Commit transaction
        await connection.commit();
        console.log('Transaction committed successfully');

        // 11. ส่ง response กลับ
        return res.json({
            success: true,
            message: 'อัพโหลดเอกสารสำเร็จ',
            data: {
                documentId: documentResult.insertId,
                rfaId: rfaResult.insertId,
                fileUrl: uploadResult.webViewLink
            }
        });

    } catch (error) {
        // 12. จัดการ error
        console.error('Error in uploadRFADocument:', {
            message: error.message,
            stack: error.stack,
            sql: error.sql,
            sqlMessage: error.sqlMessage
        });

        // Rollback ถ้ามี connection
        if (connection) {
            try {
                await connection.rollback();
                console.log('Transaction rolled back');
            } catch (rollbackError) {
                console.error('Rollback failed:', rollbackError);
            }
        }

        // ลบไฟล์ชั่วคราว
        if (req.file?.path) {
            try {
                await fs.unlink(req.file.path);
                console.log('Temporary file deleted');
            } catch (unlinkError) {
                console.error('Failed to delete temporary file:', unlinkError);
            }
        }

        return res.status(500).json({
            success: false,
            error: error.message || 'เกิดข้อผิดพลาดในการอัพโหลดเอกสาร'
        });

    } finally {
        // 13. คืน connection
        if (connection) {
            try {
                connection.release();
                console.log('Database connection released');
            } catch (releaseError) {
                console.error('Failed to release connection:', releaseError);
            }
        }
    }
};

// เพิ่มฟังก์ชันช่วยจัดการ log
function logDebug(message, data = {}) {
    console.log(`[DEBUG] ${message}`, data);
}

function logError(message, error) {
    console.error(`[ERROR] ${message}`, {
        message: error.message,
        stack: error.stack,
        ...(error.sql && { sql: error.sql }),
        ...(error.sqlMessage && { sqlMessage: error.sqlMessage })
    });
}


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
                r.status,
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
            AND r.status IN (
                'แก้ไข',
                'อนุมัติตามคอมเมนต์ (ต้องแก้ไข)',
                'ไม่อนุมัติ'
            )
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
