require('dotenv').config();
const mysql = require('mysql2');

// สร้าง connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST, // ใช้ host จาก .env
  user: process.env.DB_USER, // ใช้ user จาก .env
  password: process.env.DB_PASSWORD, // ใช้ password จาก .env
  database: process.env.DB_DATABASE, // ใช้ database จาก .env
  port: process.env.DB_PORT || 3306, // ใช้ port จาก .env หรือค่า default
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10, // connection pool limit
  queueLimit: 0,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false, // SSL connection (false สำหรับ Railway Public)
});

// เปลี่ยน pool ให้รองรับ promises
const poolPromise = pool.promise();

// ทดสอบการเชื่อมต่อ
poolPromise.getConnection()
  .then(connection => {
    console.log('Successfully connected to Railway MySQL database.');
    connection.release(); // ปล่อย connection
  })
  .catch(err => {
    console.error('Error connecting to the database:', err);
  });

module.exports = { poolPromise };
