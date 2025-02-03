exports.getLoginPage = (req, res) => {
  res.render("login", { title: "Login Page" });
};

exports.handleLogin = (req, res) => {
  const { username, password } = req.body;

  // ตรวจสอบ username และ password
  if (username === "admin" && password === "admin123") {
    res.redirect("/admin"); // Redirect ไปหน้า Admin
  } else {
    res.status(401).send("Invalid username or password");
  }
};;

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) res.status(500).send("Logout failed");
    res.redirect("/login");
  });
};

exports.getUserMenu = (req, res) => {
  res.render("userMenu", { title: "User Menu", username: "John Doe" });
};
