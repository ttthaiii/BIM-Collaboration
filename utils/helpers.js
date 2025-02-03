const bcrypt = require('bcrypt');

const helpers = {
  // เข้ารหัสรหัสผ่าน
  hashPassword: async (password) => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  },

  // ตรวจสอบรหัสผ่าน
  comparePassword: async (password, hash) => {
    return bcrypt.compare(password, hash);
  },

  // จัดรูปแบบวันที่
  formatDate: (date) => {
    return new Date(date).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
};

module.exports = helpers;