require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const cors = require('cors');
const helmet = require('helmet');

// Import routes เพียงครั้งเดียว
const userRoutes = require("./routes/user");
const adminRoutes = require("./routes/admin");

const app = express();

// Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"], // อนุญาตโหลด JS จาก CDN
        styleSrc: ["'self'", "https://cdnjs.cloudflare.com", "'unsafe-inline'"], // อนุญาต style inline
        fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"], // ไม่อนุญาต <object> หรือ <embed>
      },
    },
  })
);

app.use(cors());

// Parse Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session Store Configuration
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

// Session Middleware
app.use(
  session({
    key: "session_cookie_name",
    secret: process.env.SESSION_SECRET || "your-secret-key",
    store: sessionStore, // ใช้ MySQL Store
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // เปิด secure เฉพาะ production
      maxAge: 24 * 60 * 60 * 1000, // 1 วัน
    },
  })
);

// Middleware สำหรับส่ง user session ไปทุก view
app.use((req, res, next) => {
  res.locals.currentUser = req.session;
  next();
});

// Static and View Setup
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Routes
app.get("/", (req, res) => {
  res.redirect("/login");
});
app.use("/", userRoutes);
app.use("/admin", adminRoutes);

// Error Handlers (ใส่ท้ายสุดก่อน app.listen)
app.use((req, res, next) => {
  console.log("Current session:", req.session);
  next();
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("error", {
    message: "Internal Server Error",
    status: 500,
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
