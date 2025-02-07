const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { saveDocument } = require('./database'); // Import ฟังก์ชัน saveDocument

const FOLDER_ID = '11eB3PBJnJBhtcpghUwSo73lJh_CEGDX7';
const TEAM_DRIVE_ID = '0AAtwqQRo9hyoUk9PVA';

const createDriveClient = async () => {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: path.join(__dirname, '../config/credentials.json'),
            scopes: [
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/drive.metadata'
            ]
        });

        const client = await auth.getClient();
        return google.drive({
            version: 'v3',
            auth: client,
        });
    } catch (error) {
        console.error('Auth error:', error);
        throw error;
    }
};

const driveService = {
    uploadToDrive: async (userId, filePath, fileName) => {
        try {
            console.log('Starting upload to Team Drive...');
            const drive = await createDriveClient();

            // ตรวจสอบไฟล์
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            // ใช้ชื่อไฟล์ UTF-8
            const utf8FileName = Buffer.from(fileName, 'utf8').toString();

            // สร้าง metadata โดยใช้ชื่อไฟล์ UTF-8
            const fileMetadata = {
                name: utf8FileName, // ชื่อไฟล์ UTF-8
                parents: [FOLDER_ID],
                driveId: TEAM_DRIVE_ID
            };

            // สร้าง media object
            const media = {
                mimeType: 'image/jpeg', // เปลี่ยน MIME type หากไม่ใช่ JPEG
                body: fs.createReadStream(filePath)
            };

            console.log('Uploading with metadata:', { fileName: utf8FileName, folderId: FOLDER_ID, teamDriveId: TEAM_DRIVE_ID });

            // อัพโหลดไฟล์
            const response = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, name, webViewLink',
                supportsAllDrives: true,
                enforceSingleParent: true,
            });

            const { id: googleFileId, webViewLink: fileUrl } = response.data;
            console.log('Upload successful:', response.data);

            return response.data;
        } catch (error) {
            console.error('Upload error details:', {
                message: error.message,
                code: error.code,
                errors: error.errors,
                response: error.response?.data
            });
            throw error;
        }
    },

    verifyAccess: async () => {
        try {
            const drive = await createDriveClient();
            const teamDrive = await drive.drives.get({
                driveId: TEAM_DRIVE_ID,
                supportsAllDrives: true
            });
            console.log('Team Drive access verified:', teamDrive.data.name);
            const folder = await drive.files.get({
                fileId: FOLDER_ID,
                supportsAllDrives: true,
                fields: '*'
            });
            console.log('Folder access verified:', folder.data.name);
            return true;
        } catch (error) {
            console.error('Access verification failed:', error);
            return false;
        }
    }
};

// เรียกใช้ verifyAccess เมื่อเริ่มต้น
driveService.verifyAccess()
    .then(hasAccess => {
        if (hasAccess) {
            console.log('Drive service initialized successfully');
        } else {
            console.error('Failed to verify drive access');
        }
    })
    .catch(console.error);

module.exports = driveService;
