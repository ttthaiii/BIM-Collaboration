const multer = require('multer');
const fs = require('fs').promises;  // เปลี่ยนจาก fs เป็น fs.promises
const path = require('path');
const { saveDocument } = require('../config/database');
const driveService = require('../config/googleDrive');

const upload = multer({ dest: 'uploads/' });

exports.uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log('Upload process started:', {
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        });

        const filePath = req.file.path;
        const originalFileName = req.file.originalname;

        // ใช้ Buffer.from() เพื่อจัดการชื่อไฟล์
        const utf8FileName = Buffer.from(originalFileName, 'latin1').toString('utf8');

        // เปลี่ยนชื่อไฟล์สำหรับเซิร์ฟเวอร์
        const sanitizedFilePath = path.join(
            path.dirname(filePath),
            Date.now() + '-' + utf8FileName
        );
        
        await fs.rename(filePath, sanitizedFilePath);
        console.log('Sanitized file path:', sanitizedFilePath);

        // อัปโหลดไฟล์ไปยัง Google Drive
        const { id: googleFileId, webViewLink: fileUrl } = await driveService.uploadToDrive(
            req.session.user.id, 
            sanitizedFilePath, 
            utf8FileName,
            req.file.mimetype
        );

        console.log('Google File ID:', googleFileId);
        console.log('File URL:', fileUrl);

        // บันทึกข้อมูลลงฐานข้อมูล
        await saveDocument(req.session.user.id, utf8FileName, fileUrl, googleFileId);

        // ลบไฟล์ชั่วคราว
        try {
            await fs.unlink(sanitizedFilePath);
        } catch (unlinkError) {
            console.error('Error deleting temporary file:', unlinkError);
        }

        res.json({
            success: true,
            message: 'File uploaded successfully',
            fileId: googleFileId,
            fileUrl: fileUrl
        });

    } catch (error) {
        console.error('Upload process error:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });

        // ลบไฟล์ชั่วคราวในกรณีที่เกิด error
        if (req.file?.path) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error deleting temporary file:', unlinkError);
            }
        }

        res.status(500).json({
            success: false,
            error: 'Failed to upload file',
            details: error.message
        });
    }
};

const { downloadFromDrive } = require('../config/googleDrive');

exports.downloadFile = async (req, res) => {
    const { fileId } = req.params;
    const destination = `./downloads/${fileId}.txt`;

    try {
        await downloadFromDrive(fileId, destination);

        res.download(destination, (err) => {
            if (err) {
                console.error('Error sending file:', err);
            }
        });
    } catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).json({ error: 'Failed to download file' });
    }
};


const { deleteFromDrive } = require('../config/googleDrive');

exports.deleteFile = async (req, res) => {
    const { fileId } = req.params;

    try {
        await deleteFromDrive(fileId);

        res.json({ success: true, message: 'File deleted successfully' });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
};
