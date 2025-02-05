const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'test',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
  queueLimit: 0,
  connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT, 10) || 10000,
  ssl: process.env.DB_SSL === 'true' 
    ? { 
        rejectUnauthorized: false,
        ca: process.env.DB_CA || undefined,
        cert: process.env.DB_CERT || undefined,
        key: process.env.DB_KEY || undefined,
      } 
    : false,
});

module.exports = { poolPromise: pool };

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

pool.getConnection()
    .then(conn => {
        console.log('Successfully connected to the database.');
        conn.release();
    })
    .catch(err => {
        console.error('Database connection failed:', err);
    });

// Export Pool สำหรับการใช้งานใน Controller
module.exports = { poolPromise };
