const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost', // ตรวจสอบ host
  user: process.env.DB_USER || 'root', // username
  password: process.env.DB_PASSWORD || '', // password
  database: process.env.DB_DATABASE || 'test', // database
  port: process.env.DB_PORT || 3306, // port ค่า default 3306
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10, // ใช้ connection pool limit
  queueLimit: 0,
  connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT, 10) || 10000, // ค่า timeout
  ssl: process.env.DB_SSL === 'true' 
    ? { 
        rejectUnauthorized: false,
        ca: process.env.DB_CA || undefined, // เพิ่ม Certificate Authority ถ้าจำเป็น
        cert: process.env.DB_CERT || undefined, // เพิ่ม Certificate
        key: process.env.DB_KEY || undefined, // เพิ่ม Key
      } 
    : false,
});

const poolPromise = pool.promise();

// ตรวจสอบการเชื่อมต่อเริ่มต้น
(async () => {
  try {
    const connection = await poolPromise.getConnection();
    console.log('Successfully connected to the database.');
    connection.release();
  } catch (err) {
    console.error('Database connection failed:');
    console.error('Host:', process.env.DB_HOST || 'localhost');
    console.error('Port:', process.env.DB_PORT || 3306);
    console.error('Error:', err.message);
  }
})();

// Export Pool สำหรับการใช้งานใน Controller
module.exports = { poolPromise };
