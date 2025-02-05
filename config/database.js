const mysql = require('mysql2/promise');

// Connection string from Railway
const DATABASE_URL = 'mysql://root:CLrDiQvOhDsEjidrrkGHsDZZntOUxSbt@junction.proxy.rlwy.net:49260/railway';

const pool = mysql.createPool({
  uri: DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  ssl: {
    rejectUnauthorized: false
  }
});

const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✓ Database connected successfully');
    
    // Test query
    const [result] = await connection.query('SELECT 1 + 1 AS result');
    console.log('✓ Query test successful');
    
    connection.release();
  } catch (err) {
    console.error('✗ Database connection error:', {
      message: err.message,
      code: err.code,
      errno: err.errno
    });
  }
};

testConnection();

module.exports = { pool };