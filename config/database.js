require('dotenv').config();
const mysql = require('mysql2');

// สร้าง connection pool พร้อมการตั้งค่าจาก .env
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost', // ใช้ host จาก .env หรือ localhost
  user: process.env.DB_USER || 'root', // username จาก .env
  password: process.env.DB_PASSWORD || '', // password จาก .env
  database: process.env.DB_DATABASE || 'test', // database จาก .env
  port: process.env.DB_PORT || 3306, // port จาก .env (default 3306)
  waitForConnections: true, // รอ connection ว่าง
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10, // จำนวน connection pool limit
  queueLimit: 0, // ไม่มี limit ใน queue
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false, // ใช้ SSL หาก DB_SSL เป็น 'true'
});

// แปลง pool ให้รองรับ promises
const poolPromise = pool.promise();

// ทดสอบการเชื่อมต่อ Database
poolPromise.getConnection()
  .then(connection => {
    console.log('Successfully connected to Railway MySQL database.');
    connection.release(); // ปล่อย connection กลับ pool
  })
  .catch(err => {
    console.error('Error connecting to the database:', err);
  });

// ส่งออก poolPromise เพื่อใช้ในที่อื่น
module.exports = { poolPromise };
