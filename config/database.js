const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST, // ตรวจสอบว่าถูกต้องหรือไม่
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000, // เพิ่ม timeout เป็น 10 วินาที
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false, // ใช้ SSL หากจำเป็น
});

const poolPromise = pool.promise();

poolPromise.getConnection()
  .then(connection => {
    console.log('Successfully connected to the database.');
    connection.release();
  })
  .catch(err => {
    console.error('Database connection failed:');
    console.error('Host:', process.env.DB_HOST);
    console.error('Port:', process.env.DB_PORT);
    console.error(err);
  });

module.exports = { poolPromise };
