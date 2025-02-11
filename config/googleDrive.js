const { google } = require('googleapis');
const fs = require('fs').promises;
const fsSync = require('fs');
const crypto = require('crypto');

// Set OpenSSL version
crypto.constants.OPENSSL_VERSION_NUMBER = crypto.constants.OPENSSL_VERSION_NUMBER || 0x1010106f;

// Environment variables validation
const checkRequiredEnvVars = () => {
    const required = [
        'GOOGLE_CLIENT_EMAIL',
        'GOOGLE_PRIVATE_KEY',
        'GOOGLE_DRIVE_FOLDER_ID',
        'GOOGLE_TEAM_DRIVE_ID'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
};

// Private key validation and formatting
const formatPrivateKey = (key) => {
    try {
        // ถ้าเป็น base64 ให้ decode ก่อน
        try {
            const decoded = Buffer.from(key, 'base64').toString();
            if (decoded.includes('PRIVATE KEY')) {
                key = decoded;
            }
        } catch (e) {
            console.log('Key is not in base64 format');
        }

        // ทำความสะอาด key
        key = key.replace(/\\n/g, '\n')
                 .replace(/["']/g, '')
                 .trim();

        // ตรวจสอบรูปแบบ
        if (!key.includes('-----BEGIN PRIVATE KEY-----')) {
            key = '-----BEGIN PRIVATE KEY-----\n' + key;
        }
        if (!key.includes('-----END PRIVATE KEY-----')) {
            key = key + '\n-----END PRIVATE KEY-----';
        }

        return key;
    } catch (error) {
        console.error('Error formatting private key:', error);
        throw error;
    }
};

// Create Google Drive client
const createDriveClient = async () => {
    try {
        const privateKey = formatPrivateKey(process.env.GOOGLE_PRIVATE_KEY);

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: privateKey
            },
            scopes: [
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/drive.file'
            ]
        });

        const client = await auth.getClient();
        return google.drive({ version: 'v3', auth: client });
    } catch (error) {
        console.error('Error creating drive client:', error);
        throw error;
    }
};


// File name sanitization
const sanitizeFileName = (fileName) => {
    try {
        // Remove invalid characters and normalize
        let sanitized = fileName
            .replace(/[^\w\s.-]/g, '')  // Remove invalid characters
            .replace(/\s+/g, '_')       // Replace spaces with underscores
            .trim();

        // Ensure the filename isn't empty after sanitization
        if (!sanitized) {
            sanitized = 'untitled_' + Date.now();
        }

        // Add timestamp to ensure uniqueness
        const ext = sanitized.split('.').pop();
        const name = sanitized.slice(0, sanitized.lastIndexOf('.'));
        return `${name}_${Date.now()}.${ext}`;
    } catch (error) {
        console.error('Error sanitizing filename:', error);
        return `untitled_${Date.now()}.unknown`;
    }
};

// Main service object
const driveService = {
    uploadToDrive: async (userId, filePath, fileName, mimetype) => {
        try {
            console.log('Starting file upload process:', { userId, fileName });
            const drive = await createDriveClient();

            if (!fsSync.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const fileMetadata = {
                name: fileName,
                parents: [process.env.GOOGLE_DRIVE_FOLDER_ID]
            };

            const media = {
                mimeType: mimetype,
                body: fsSync.createReadStream(filePath)
            };

            console.log('Uploading to Google Drive...');
            const response = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, name, webViewLink',
                supportsAllDrives: true
            });

            try {
                await drive.permissions.create({
                    fileId: response.data.id,
                    requestBody: {
                        role: 'reader',
                        type: 'anyone'
                    },
                    supportsAllDrives: true
                });
            } catch (permError) {
                console.warn('Permission setting failed:', permError);
            }

            console.log('Upload successful:', {
                id: response.data.id,
                name: response.data.name,
                link: response.data.webViewLink
            });

            return response.data;

        } catch (error) {
            console.error('Upload failed:', error);
            throw error;
        }
    },

    verifyAccess: async () => {
        try {
            const drive = await createDriveClient();
            const result = await drive.files.list({
                pageSize: 1,
                supportsAllDrives: true
            });
            console.log('Drive access verified');
            return true;
        } catch (error) {
            console.error('Drive access verification failed:', error);
            return false;
        }
    },

    initialize: async () => {
        try {
            const hasAccess = await driveService.verifyAccess();
            if (!hasAccess) {
                throw new Error('Failed to verify Google Drive access');
            }
            console.log('Google Drive service initialized successfully');
            return true;
        } catch (error) {
            console.error('Service initialization failed:', error);
            throw error;
        }
    },


    deleteFile: async (fileId) => {
        try {
            const drive = await createDriveClient();
            await drive.files.delete({
                fileId: fileId,
                supportsAllDrives: true
            });
            return true;
        } catch (error) {
            console.error('File deletion failed:', error);
            throw error;
        }
    }
};

module.exports = driveService;