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
const validateAndFormatPrivateKey = () => {
    try {
        let privateKey = process.env.GOOGLE_PRIVATE_KEY;
        
        // Try to decode if it's base64 encoded
        try {
            const decoded = Buffer.from(privateKey, 'base64').toString();
            if (decoded.includes('PRIVATE KEY')) {
                privateKey = decoded;
            }
        } catch (e) {
            console.log('Key is not in base64 format, processing as-is');
        }

        // Clean up the private key format
        privateKey = privateKey
            .replace(/\\n/g, '\n')
            .replace(/["']/g, '')
            .trim();

        // Ensure proper header and footer
        if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
            privateKey = '-----BEGIN PRIVATE KEY-----\n' + privateKey;
        }
        if (!privateKey.includes('-----END PRIVATE KEY-----')) {
            privateKey = privateKey + '\n-----END PRIVATE KEY-----';
        }

        // Validate final format
        if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || 
            !privateKey.includes('-----END PRIVATE KEY-----')) {
            throw new Error('Invalid private key format after processing');
        }

        return privateKey;
    } catch (error) {
        console.error('Private key validation/formatting failed:', error);
        throw error;
    }
};

// Create Google Drive client
const createDriveClient = async () => {
    try {
        const privateKey = validateAndFormatPrivateKey();
        
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: privateKey
            },
            scopes: [
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/drive.metadata'
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
            if (!userId || !filePath || !fileName) {
                throw new Error('Missing required parameters for upload');
            }

            console.log('Starting file upload process:', { userId, fileName });
            const drive = await createDriveClient();

            // Verify file exists
            if (!fsSync.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const sanitizedFileName = sanitizeFileName(fileName);

            // Check for existing file
            const existingFiles = await drive.files.list({
                q: `name = '${sanitizedFileName}' and '${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed = false`,
                fields: 'files(id, name, webViewLink)',
                spaces: 'drive',
                supportsAllDrives: true
            });

            if (existingFiles.data.files.length > 0) {
                console.log('File already exists:', existingFiles.data.files[0]);
                return existingFiles.data.files[0];
            }

            // Prepare upload
            const fileMetadata = {
                name: sanitizedFileName,
                parents: [process.env.GOOGLE_DRIVE_FOLDER_ID]
            };

            const media = {
                mimeType: mimetype,
                body: fsSync.createReadStream(filePath)
            };

            // Perform upload
            const response = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, name, webViewLink, mimeType, size',
                supportsAllDrives: true,
                enforceSingleParent: true
            });

            console.log('Upload successful:', response.data);
            return response.data;

        } catch (error) {
            console.error('Upload failed:', error);
            throw error;
        }
    },

    verifyAccess: async () => {
        try {
            const drive = await createDriveClient();
            const teamDrive = await drive.drives.get({
                driveId: process.env.GOOGLE_TEAM_DRIVE_ID,
                supportsAllDrives: true
            });

            console.log('Team Drive access verified:', teamDrive.data.name);
            return true;
        } catch (error) {
            console.error('Team Drive access verification failed:', error);
            return false;
        }
    },

    initialize: async () => {
        try {
            console.log('Initializing Google Drive service...');
            
            // Check environment variables
            checkRequiredEnvVars();
            
            // Verify access
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