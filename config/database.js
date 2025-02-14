const mysql = require('mysql2/promise');

// ดึง DATABASE_URL จาก environment variable หรือใช้ค่าที่กำหนดไว้
const DATABASE_URL = process.env.DATABASE_URL || 'mysql://root:CLrDiQvOhDsEjidrrkGHsDZZntOUxSbt@junction.proxy.rlwy.net:49260/railway';

const pool = mysql.createPool({
    ...mysql.createPool(DATABASE_URL), // ใช้ค่า config จาก URL
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 300000,
    maxIdle: 3,
    idleTimeout: 300000,
    // เพิ่มการตั้งค่า timeout
    connectTimeout: 60000, // เพิ่มเวลารอเป็น 60 วินาที
    acquireTimeout: 60000,
    timeout: 60000
});

// เพิ่มฟังก์ชัน reconnect
async function reconnect() {
    try {
        const connection = await pool.getConnection();
        console.log('Successfully reconnected to database');
        connection.release();
    } catch (err) {
        console.error('Reconnection failed:', err);
        // ลองใหม่ทุก 30 วินาที
        setTimeout(reconnect, 30000);
    }
}

// แก้ไข testConnection function
const testConnection = async (retries = 3) => {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('✓ Database connected successfully');
        
        const [result] = await connection.query('SELECT 1 as result');
        console.log('✓ Query test successful:', result);
        
        return true;
    } catch (err) {
        console.error('✗ Database connection error:', {
            message: err.message,
            code: err.code,
            errno: err.errno
        });

        if (retries > 0) {
            console.log(`Retrying connection... (${retries} attempts remaining)`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            return testConnection(retries - 1);
        }
        
        return false;
    } finally {
        if (connection) {
            try {
                connection.release();
            } catch (e) {
                console.error('Error releasing connection:', e);
            }
        }
    }
};

async function saveDocument(userId, fileName, fileUrl, fileId) {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Starting document save transaction...');
        
        await connection.beginTransaction();
        
        // เช็คว่ามีไฟล์นี้ในระบบแล้วหรือไม่
        const [existing] = await connection.query(
            'SELECT id FROM documents WHERE google_file_id = ?',
            [fileId]
        );

        if (existing.length > 0) {
            console.log('Document already exists, ID:', existing[0].id);
            await connection.commit();
            return existing[0].id;
        }

        console.log('Saving new document:', { fileName, fileId });
        const [result] = await connection.query(
            'INSERT INTO documents (user_id, file_name, file_url, google_file_id) VALUES (?, ?, ?, ?)',
            [userId, fileName, fileUrl, fileId]
        );

        await connection.commit();
        console.log('Document saved successfully, ID:', result.insertId);
        return result.insertId;
        
    } catch (error) {
        console.error('Error saving document:', {
            error: error.message,
            fileName,
            fileId
        });
        if (connection) {
            await connection.rollback();
            console.log('Transaction rolled back');
        }
        throw error;
    } finally {
        if (connection) {
            connection.release();
            console.log('Database connection released');
        }
    }
}


// Run initial connection test
testConnection();
// ตั้งเวลาเช็คการเชื่อมต่อทุก 10 นาที
setInterval(keepAlive, 600000);

module.exports = { pool, testConnection, saveDocument };