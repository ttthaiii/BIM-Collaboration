const { body, validationResult } = require('express-validator');

const validate = {
  // กฎการตรวจสอบสำหรับฟิลด์ทั่วไป
  usernameRule: () =>
    body('username')
      .notEmpty().withMessage('Username is required')
      .isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),

  passwordRule: () =>
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),

  jobPositionRule: () =>
    body('job_position')
      .notEmpty().withMessage('Job position is required')
      .isIn(['Manager', 'Supervisor', 'Staff']).withMessage('Invalid job position'),

  // Validation สำหรับการเพิ่ม/แก้ไขผู้ใช้
  userValidationRules: () => {
    return [
      validate.usernameRule(),
      validate.passwordRule(),
      validate.jobPositionRule(),
    ];
  },

  // Validation สำหรับการเพิ่มโครงการ
  siteValidationRules: () => {
    return [
      body('site_name')
        .notEmpty().withMessage('Site name is required')
        .isLength({ min: 3 }).withMessage('Site name must be at least 3 characters'),
    ];
  },

  // ฟังก์ชันตรวจสอบผลการ Validate
  validateInput: (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array().map(err => ({
          field: err.param,
          message: err.msg,
        })),
      });
    }
    next();
  }
};

module.exports = validate;
