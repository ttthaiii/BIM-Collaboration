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
    // ค้นหาข้อมูลผู้ใช้จากฐานข้อมูล
    const [users] = await poolPromise.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    // ถ้าไม่พบผู้ใช้ ให้ส่งกลับพร้อมข้อความผิดพลาด
    if (users.length === 0) {
      return res.render("login", {
        title: "Login Page",
        errorMessage: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", // กรณีไม่พบผู้ใช้
      });
    }

    const user = users[0];

    // ตรวจสอบรหัสผ่านด้วย bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.render("login", {
        title: "Login Page",
        errorMessage: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", // กรณีรหัสผ่านผิด
      });
    }

    // บันทึกข้อมูลผู้ใช้ในเซสชัน
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;

    console.log("Session หลังการล็อกอิน:", req.session);

    // ตรวจสอบ role และเปลี่ยนเส้นทาง
    if (user.role === "admin") {
      return res.redirect("/admin");
    } else {
      return res.redirect("/user/menu");
    }
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
      const [documents] = await pool.query(
          "SELECT * FROM documents WHERE user_id = ?", 
          [req.session.user.id]
      );
      res.render('userDashboard', { 
          documents,
          user: req.session.user 
      });
  } catch (err) {
      console.error("Error loading user documents:", err);
      res.status(500).render('error', { 
          message: "Failed to load user documents", 
          error: process.env.NODE_ENV === 'development' ? err : {} 
      });
  }
};
