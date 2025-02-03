const logger = require('../utils/logger');

const errorHandler = {
  // จัดการ 404 Error
  notFound: (req, res, next) => {
    const error = new Error('Not Found');
    error.status = 404;
    next(error);
  },

  // จัดการ Error ทั่วไป
  handleError: (err, req, res, next) => {
    logger.error(err.stack);

    res.status(err.status || 500);
    res.render('error', {
      message: process.env.NODE_ENV === 'development' 
        ? err.message 
        : 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  }
};

module.exports = errorHandler;