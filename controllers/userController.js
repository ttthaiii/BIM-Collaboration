const bcrypt = require("bcrypt");
const { poolPromise } = require("../config/database");

// แสดงหน้า Login
exports.getLoginPage = (req, res) => {
  res.render("login", { title: "Login Page", errorMessage: null });
};

// จัดการการ Login
exports.handleLogin = async (req, res) => {
  const { username, password } = req.body;

  try {
    // ดึงข้อมูลผู้ใช้จากฐานข้อมูล
    const [users] = await poolPromise.query("SELECT * FROM users WHERE username = ?", [username]);
    if (users.length === 0) {
      return res.render("login", { title: "Login Page", errorMessage: "Invalid username or password" });
    }

    const user = users[0];

    // ตรวจสอบรหัสผ่าน
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.render("login", { title: "Login Page", errorMessage: "Invalid username or password" });
    }

    // เก็บข้อมูลผู้ใช้ในเซสชัน
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;

    console.log("Session after login:", req.session);

    // ตรวจสอบ role และ Redirect
    if (user.role === "admin") {
      return res.redirect("/admin");
    } else {
      return res.redirect("/user/menu");
    }
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).send("An error occurred during login");
  }
};

// Logout
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout failed:", err);
      return res.status(500).send("Logout failed");
    }
    res.redirect("/login");
  });
};

// แสดงหน้าเมนูของผู้ใช้
exports.getUserMenu = (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect("/login");
  }

  res.render("userMenu", { 
    title: "User Menu", 
    username: req.session.username || "User"
  });
};
