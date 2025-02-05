const mysql = require('mysql2/promise');

// ดึง DATABASE_URL จาก environment variable หรือใช้ค่าที่กำหนดไว้
const DATABASE_URL = process.env.DATABASE_URL || 'mysql://root:CLrDiQvOhDsEjidrrkGHsDZZntOUxSbt@junction.proxy.rlwy.net:49260/railway';

const pool = mysql.createPool(DATABASE_URL);

// Test database connection
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

// Run initial connection test
testConnection();

module.exports = { pool, testConnection };