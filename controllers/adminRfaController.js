const fs = require('fs').promises;
const { pool } = require('../config/database');
const driveService = require('../config/googleDrive');

// ดึงเอกสารตามตำแหน่งและสถานะที่กำหนด
exports.getDocumentsByPosition = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const userId = req.session.user.id;
        const position = req.session.user.jobPosition;

        // กำหนดสถานะตามตำแหน่งงาน
        let statusFilter;
        switch(position) {
            case 'Adminsite':
                statusFilter = ['BIM ส่งแบบ'];
                break;
            case 'Adminsite2':
                statusFilter = ['BIM ส่งแบบ', 'ส่ง CM'];
                break;
            case 'CM':
                statusFilter = ['ส่ง CM'];
                break;
            default:
                throw new Error('ตำแหน่งงานไม่ถูกต้อง');
        }

        const [documents] = await connection.query(`
            SELECT 
                rd.id,
                wc.category_code,
                rd.document_number,
                rd.revision_number,
                rd.title,
                rd.status,
                d.file_url,
                DATE_FORMAT(rd.created_at, '%d/%m/%Y') as created_at,
                u.username as created_by_name
            FROM rfa_documents rd
            JOIN documents d ON rd.document_id = d.id
            JOIN work_categories wc ON rd.category_id = wc.id
            JOIN users u ON rd.created_by = u.id
            JOIN user_sites us ON rd.site_id = us.site_id
            WHERE us.user_id = ?
            AND rd.status IN (?)
            ORDER BY rd.created_at DESC
        `, [userId, statusFilter]);

        res.json({
            success: true,
            documents
        });

    } catch (error) {
        console.error('Error in getDocumentsByPosition:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (connection) connection.release();
    }
};

// ค้นหาเอกสาร
exports.searchDocuments = async (req, res) => {
    let connection;
    try {
        const { searchTerm } = req.query;
        const userId = req.session.user.id;
        const position = req.session.user.jobPosition;

        // กำหนดสถานะตามตำแหน่งงาน (เหมือนด้านบน)
        let statusFilter;
        switch(position) {
            case 'Adminsite':
                statusFilter = ['BIM ส่งแบบ'];
                break;
            case 'Adminsite2':
                statusFilter = ['BIM ส่งแบบ', 'ส่ง CM'];
                break;
            case 'CM':
                statusFilter = ['ส่ง CM'];
                break;
            default:
                throw new Error('ตำแหน่งงานไม่ถูกต้อง');
        }

        connection = await pool.getConnection();

        // แยกหมวดงานและเลขที่เอกสาร (ถ้ามี)
        let categoryCode = null;
        let documentNumber = null;
        const docMatch = searchTerm.match(/^([A-Za-z]+)[\s-]?(\d+)$/);
        
        if (docMatch) {
            categoryCode = docMatch[1];
            documentNumber = docMatch[2];
        }

        let query = `
            SELECT 
                rd.id,
                wc.category_name,
                rd.document_number,
                rd.revision_number,
                rd.title,
                rd.status,
                d.file_url,
                DATE_FORMAT(rd.created_at, '%d/%m/%Y') as created_at,
                u.username as created_by_name
            FROM rfa_documents rd
            JOIN documents d ON rd.document_id = d.id
            JOIN work_categories wc ON rd.category_id = wc.id
            JOIN users u ON rd.created_by = u.id
            JOIN user_sites us ON rd.site_id = us.site_id
            WHERE us.user_id = ?
            AND rd.status IN (?)
        `;

        const params = [userId, statusFilter];

        if (categoryCode && documentNumber) {
            query += ` AND wc.category_code = ? AND rd.document_number = ?`;
            params.push(categoryCode, documentNumber);
        } else {
            query += ` AND (rd.title LIKE ? OR CONCAT(wc.category_name, '-', rd.document_number) LIKE ?)`;
            params.push(`%${searchTerm}%`, `%${searchTerm}%`);
        }

        query += ` ORDER BY rd.created_at DESC`;

        const [documents] = await connection.query(query, params);

        res.json({
            success: true,
            documents
        });

    } catch (error) {
        console.error('Error in searchDocuments:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (connection) connection.release();
    }
};

// อัพเดทสถานะเอกสาร
exports.updateDocumentStatus = async (req, res) => {
    let connection;
    try {
        const { documentId, newStatus } = req.body;
        const position = req.session.user.jobPosition;

        // ตรวจสอบสถานะที่อนุญาตตามตำแหน่งงาน
        let allowedStatuses;
        switch(position) {
            case 'Adminsite':
                allowedStatuses = ['ส่ง CM', 'แก้ไข'];
                break;
            case 'Adminsite2':
                allowedStatuses = ['ส่ง CM', 'แก้ไข', 'อนุมัติ', 
                    'อนุมัติตามคอมเมนต์ (ไม่ต้องแก้ไข)',
                    'อนุมัติตามคอมเมนต์ (ต้องแก้ไข)', 'ไม่อนุมัติ'];
                break;
            case 'CM':
                allowedStatuses = ['อนุมัติ', 'อนุมัติตามคอมเมนต์ (ไม่ต้องแก้ไข)',
                    'อนุมัติตามคอมเมนต์ (ต้องแก้ไข)', 'ไม่อนุมัติ'];
                break;
            default:
                throw new Error('ตำแหน่งงานไม่ถูกต้อง');
        }

        if (!allowedStatuses.includes(newStatus)) {
            throw new Error('สถานะที่เลือกไม่ได้รับอนุญาต');
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // ตรวจสอบสถานะซ้ำ
        const [existingStatus] = await connection.query(
            'SELECT status FROM rfa_documents WHERE id = ? AND status = ?',
            [documentId, newStatus]
        );

        if (existingStatus.length > 0) {
            throw new Error('เอกสารนี้มีสถานะนี้อยู่แล้ว');
        }

        // อัพโหลดไฟล์ใหม่ (ถ้ามี)
        let fileUrl = null;
        let googleFileId = null;

        if (req.file) {
            const uploadResult = await driveService.uploadToDrive(
                req.session.user.id,
                req.file.path,
                req.file.originalname,
                req.file.mimetype
            );
            fileUrl = uploadResult.webViewLink;
            googleFileId = uploadResult.id;

            // บันทึกข้อมูลเอกสารใหม่
            const [docResult] = await connection.query(
                'INSERT INTO documents (user_id, file_name, file_url, google_file_id) VALUES (?, ?, ?, ?)',
                [req.session.user.id, req.file.originalname, fileUrl, googleFileId]
            );

            // อัพเดทข้อมูล RFA
            await connection.query(
                'UPDATE rfa_documents SET status = ?, document_id = ? WHERE id = ?',
                [newStatus, docResult.insertId, documentId]
            );
        } else {
            // อัพเดทเฉพาะสถานะ
            await connection.query(
                'UPDATE rfa_documents SET status = ? WHERE id = ?',
                [newStatus, documentId]
            );
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'อัพเดทสถานะเอกสารสำเร็จ'
        });

    } catch (error) {
        if (connection) await connection.rollback();
        
        console.error('Error in updateDocumentStatus:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (connection) connection.release();
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(console.error);
        }
    }
};