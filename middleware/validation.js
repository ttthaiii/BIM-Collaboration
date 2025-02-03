const { body, validationResult } = require('express-validator');

const validate = {
  // กฎการตรวจสอบสำหรับการเพิ่ม/แก้ไขผู้ใช้
  userValidationRules: () => {
    return [
      body('username')
        .notEmpty().withMessage('Username is required')
        .isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
      body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
      body('job_position')
        .notEmpty().withMessage('Job position is required')
        .isIn(['Manager', 'Supervisor', 'Staff']).withMessage('Invalid job position')
    ];
  },

  // ฟังก์ชันตรวจสอบผลการ Validate
  validateInput: (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
};

module.exports = validate;