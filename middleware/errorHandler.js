const logger = require('../utils/logger');

const errorHandler = {
  // จัดการ 404 Error
  notFound: (req, res, next) => {
    const error = new Error(`Route ${req.originalUrl} not found`);
    error.status = 404;
    next(error);
  },

  // จัดการ Error ทั่วไป
  handleError: (err, req, res, next) => {
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Log ข้อผิดพลาดที่ละเอียด
    logger.error(`
      Error: ${err.message}
      Status: ${err.status || 500}
      Stack: ${isDevelopment ? err.stack : 'Hidden in production'}
      URL: ${req.originalUrl}
      Method: ${req.method}
      IP: ${req.ip}
    `);

    // ตรวจสอบประเภทการขอ (API หรือ View)
    if (req.accepts('json')) {
      // จัดการ Error สำหรับ API
      res.status(err.status || 500).json({
        message: isDevelopment ? err.message : 'Something went wrong',
        error: isDevelopment ? err : {},
      });
    } else {
      // จัดการ Error สำหรับ View
      res.status(err.status || 500).render('error', {
        message: isDevelopment ? err.message : 'Something went wrong',
        error: isDevelopment ? err : {},
      });
    }
  },
};

module.exports = errorHandler;