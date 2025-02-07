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

// Private key validation
const validatePrivateKey = () => {
    try {
        const privateKey = process.env.GOOGLE_PRIVATE_KEY;
        console.log('Private key format check:');
        console.log('- Starts with BEGIN:', privateKey.includes('-----BEGIN PRIVATE KEY-----'));
        console.log('- Ends with END:', privateKey.includes('-----END PRIVATE KEY-----'));
        console.log('- Contains newlines:', privateKey.includes('\\n'));
        
        if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || 
            !privateKey.includes('-----END PRIVATE KEY-----')) {
            throw new Error('Invalid private key format');
        }
        
        return true;
    } catch (error) {
        console.error('Private key validation failed:', error);
        return false;
    }
};

// Create Google Drive client
const createDriveClient = async () => {
    try {
        // Format private key
        const formatPrivateKey = (key) => {
            if (!key) return '';
            const keyString = key
                .replace(/\\n/g, '\n')
                .replace(/"\n/g, '\n')
                .replace(/\n"/g, '\n')
                .replace(/^"/, '')
                .replace(/"$/, '');
            
            if (!keyString.includes('-----BEGIN PRIVATE KEY-----')) {
                return '-----BEGIN PRIVATE KEY-----\n' + keyString;
            }
            if (!keyString.includes('-----END PRIVATE KEY-----')) {
                return keyString + '\n-----END PRIVATE KEY-----';
            }
            return keyString;
        };

        const privateKey = formatPrivateKey(process.env.GOOGLE_PRIVATE_KEY);

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: privateKey
            },
            scopes: [
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/drive.metadata',
            ],
        });

        console.log('✅ Auth configuration created successfully');
        
        const client = await auth.getClient();
        return google.drive({ version: 'v3', auth: client });
    } catch (error) {
        console.error('❌ Error creating drive client:', {
            message: error.message,
            name: error.name,
            code: error.code,
            stack: error.stack
        });
        throw error;
    }
};

// Main service object
const driveService = {
    uploadToDrive: async (userId, filePath, fileName, mimetype) => {
        try {
            // Input validation
            if (!userId || !filePath || !fileName) {
                throw new Error('Missing required parameters for upload');
            }

            console.log('🚀 Starting Google Drive upload process...');
            const drive = await createDriveClient();

            // Verify file exists
            if (!fsSync.existsSync(filePath)) {
                throw new Error(`❌ File not found: ${filePath}`);
            }

            // Prepare UTF-8 filename
            const utf8FileName = Buffer.from(fileName, 'utf8').toString();

            // Prepare metadata
            const fileMetadata = {
                name: utf8FileName,
                parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
            };

            // Prepare media
            const media = {
                mimeType: mimetype,
                body: fsSync.createReadStream(filePath),
            };

            console.log(`📂 Uploading: ${utf8FileName} to folder: ${process.env.GOOGLE_DRIVE_FOLDER_ID}`);

            // Perform upload
            const response = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, name, webViewLink, mimeType, size',
                supportsAllDrives: true,
                enforceSingleParent: true,
            });

            console.log('✅ Upload successful:', response.data);
            return response.data;

        } catch (error) {
            console.error('❌ Upload error:', {
                userId,
                fileName,
                errorMessage: error.message,
                errorCode: error.code,
                errorStack: error.stack
            });
            throw error;
        }
    },

    verifyAccess: async () => {
        try {
            const drive = await createDriveClient();
            const teamDrive = await drive.drives.get({
                driveId: process.env.GOOGLE_TEAM_DRIVE_ID,
                supportsAllDrives: true,
            });

            console.log('✅ Team Drive access verified:', teamDrive.data.name);
            return true;
        } catch (error) {
            console.error('❌ Team Drive access failed:', error.message);
            return false;
        }
    },
};

// Service initialization
async function initializeService() {
    try {
        console.log('🔄 Initializing Google Drive service...');
        checkRequiredEnvVars();
        const isValidKey = validatePrivateKey();
        
        if (!isValidKey) {
            throw new Error('Private key validation failed');
        }

        const hasAccess = await driveService.verifyAccess();
        if (!hasAccess) {
            throw new Error('Failed to verify Google Drive access');
        }

        console.log('✅ Google Drive service initialized successfully');
    } catch (error) {
        console.error('❌ Service initialization failed:', error);
        throw error;
    }
}

// Initialize service
initializeService().catch(error => {
    console.error('❌ Fatal: Service initialization failed', error);
    process.exit(1);
});

module.exports = driveService;