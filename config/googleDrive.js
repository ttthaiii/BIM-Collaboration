const { google } = require('googleapis');
const fs = require('fs');

// ตรวจสอบว่า Environment Variables ถูกตั้งค่าหรือไม่
if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('❌ Google API Credentials ไม่ถูกตั้งค่าใน Environment Variables');
}

// ตั้งค่า Google Auth ด้วย Environment Variables
const createDriveClient = async () => {
    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // แปลง \\n เป็น newline
            },
            scopes: [
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/drive.metadata',
            ],
        });

        const client = await auth.getClient();
        return google.drive({
            version: 'v3',
            auth: client,
        });
    } catch (error) {
        console.error('❌ Auth error:', error.message);
        throw error;
    }
};

// ฟังก์ชันอัปโหลดไฟล์ไปยัง Google Drive
const driveService = {
    uploadToDrive: async (userId, filePath, fileName) => {
        try {
            console.log('🚀 กำลังอัปโหลดไฟล์ไปยัง Google Drive...');
            const drive = await createDriveClient();

            // ตรวจสอบว่าไฟล์มีอยู่จริงหรือไม่
            if (!fs.existsSync(filePath)) {
                throw new Error(`❌ ไม่พบไฟล์: ${filePath}`);
            }

            // ตั้งค่าชื่อไฟล์แบบ UTF-8
            const utf8FileName = Buffer.from(fileName, 'utf8').toString();

            // สร้าง metadata
            const fileMetadata = {
                name: utf8FileName,
                parents: [process.env.GOOGLE_DRIVE_FOLDER_ID], // ใช้ Folder ID จาก Environment Variables
            };

            // สร้าง media object
            const media = {
                mimeType: 'image/jpeg', // แก้ MIME Type ตามประเภทของไฟล์
                body: fs.createReadStream(filePath),
            };

            console.log(`📂 อัปโหลดไฟล์: ${utf8FileName} ไปที่โฟลเดอร์ ${process.env.GOOGLE_DRIVE_FOLDER_ID}`);

            // อัปโหลดไฟล์ไปยัง Google Drive
            const response = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, name, webViewLink',
                supportsAllDrives: true,
                enforceSingleParent: true,
            });

            console.log('✅ อัปโหลดสำเร็จ:', response.data);

            return response.data;
        } catch (error) {
            console.error('❌ เกิดข้อผิดพลาดระหว่างอัปโหลด:', error.message);
            throw error;
        }
    },

    // ฟังก์ชันตรวจสอบการเข้าถึง Google Drive
    verifyAccess: async () => {
        try {
            const drive = await createDriveClient();
            const teamDrive = await drive.drives.get({
                driveId: process.env.GOOGLE_TEAM_DRIVE_ID, // ใช้ Team Drive ID จาก Environment Variables
                supportsAllDrives: true,
            });

            console.log('✅ สามารถเข้าถึง Team Drive:', teamDrive.data.name);
            return true;
        } catch (error) {
            console.error('❌ ไม่สามารถเข้าถึง Team Drive:', error.message);
            return false;
        }
    },
};

// ตรวจสอบการเข้าถึง Google Drive เมื่อเริ่มต้น
driveService.verifyAccess()
    .then(hasAccess => {
        if (hasAccess) {
            console.log('✅ Drive service พร้อมใช้งาน');
        } else {
            console.error('❌ ไม่สามารถเข้าถึง Google Drive');
        }
    })
    .catch(console.error);

module.exports = driveService;
