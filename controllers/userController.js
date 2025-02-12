const bcrypt = require('bcryptjs');
const { pool } = require("../config/database"); // แก้จาก poolPromise เป็น pool

// แสดงหน้า Login
exports.getLoginPage = (req, res) => {
  res.render("login", {
    title: "Login Page",
    errorMessage: null, // กำหนดค่าเริ่มต้นของข้อความผิดพลาดให้เป็น null
  });
};

// จัดการการ Login
exports.handleLogin = async (req, res) => {
  const { username, password } = req.body;

  try {
    const [users] = await pool.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (users.length === 0) {
      return res.render("login", {
        title: "Login Page",
        errorMessage: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
      });
    }

    const user = users[0];

    // ตรวจสอบรหัสผ่านด้วย bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.render("login", {
        title: "Login Page",
        errorMessage: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
      });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;

    res.redirect(user.role === "admin" ? "/admin" : "/user/dashboard");

  } catch (err) {
    console.error("เกิดข้อผิดพลาดระหว่างการล็อกอิน:", err);
    return res.status(500).send("เกิดข้อผิดพลาดในระบบ");
  }
};

// Logout
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout failed:", err);
      return res.status(500).send("Logout failed");
    }
    res.clearCookie("session_cookie_name"); // ล้างคุกกี้
    return res.redirect("/login");
  });
};

// แสดงหน้าเมนูของผู้ใช้
exports.getUserMenu = (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect("/login");
  }

  res.render("userMenu", {
    title: "User Menu",
    username: req.session.username || "User", // แสดงชื่อผู้ใช้จาก session
  });
};

exports.getUserDocuments = async (req, res) => {
  try {
      const [userData] = await pool.query(`
          SELECT u.* 
          FROM users u
          WHERE u.id = ?
          LIMIT 1
      `, [req.session.user.id]);

      const [sites] = await pool.query(`
          SELECT DISTINCT s.* 
          FROM sites s
          INNER JOIN user_sites us ON s.id = us.site_id
          WHERE us.user_id = ?
          ORDER BY s.site_name ASC
      `, [req.session.user.id]);

      if (!userData.length) {
          throw new Error('User not found');
      }

      res.render('userDashboard', {
          user: {
              ...req.session.user,
              jobPosition: userData[0].job_position
          },
          sites: sites
      });

  } catch (error) {
      console.error('Error in getUserDocuments:', error);
      res.status(500).render('error', { 
          error: 'Failed to load dashboard: ' + error.message 
      });
  }
};