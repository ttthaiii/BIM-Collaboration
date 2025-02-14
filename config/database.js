const mysql = require('mysql2/promise');

// ดึง DATABASE_URL จาก environment variable หรือใช้ค่าที่กำหนดไว้
const DATABASE_URL = process.env.DATABASE_URL || 'mysql://root:CLrDiQvOhDsEjidrrkGHsDZZntOUxSbt@junction.proxy.rlwy.net:49260/railway';

// แยกค่า config จาก URL
const pool = mysql.createPool({
    uri: DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
});

// ทดสอบการเชื่อมต่อครั้งแรก
const testConnection = async () => {
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
        await connection.beginTransaction();
        
        const [existing] = await connection.query(
            'SELECT id FROM documents WHERE google_file_id = ?',
            [fileId]
        );

        if (existing.length > 0) {
            console.log('Document already exists in database');
            await connection.commit();
            return existing[0].id;
        }

        const [result] = await connection.query(
            'INSERT INTO documents (user_id, file_name, file_url, google_file_id) VALUES (?, ?, ?, ?)',
            [userId, fileName, fileUrl, fileId]
        );

        await connection.commit();
        return result.insertId;
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

// เริ่มการตรวจสอบการเชื่อมต่อ
testConnection();

module.exports = { pool, testConnection, saveDocument };