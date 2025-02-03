const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.json()
  ),
  transports: [
    // บันทึก Error logs
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error'
    }),
    // บันทึก Combined logs
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/combined.log')
    })
  ]
});

// เพิ่ม Console transport ในโหมด Development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;