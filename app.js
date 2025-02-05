require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const MySQLStore = require('express-mysql-session')(session);
const cors = require('cors');
const helmet = require('helmet');

// Import routes
const userRoutes = require('./routes/user');
const adminRoutes = require("./routes/admin");

const app = express();

// เลือก Store ตาม Environment
let sessionStore;
if (process.env.NODE_ENV === 'production') {
  // MySQLStore สำหรับ Production
  sessionStore = new MySQLStore({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
} else {
  // MemoryStore สำหรับ Development
  sessionStore = new MemoryStore({
    checkPeriod: 86400000, // ล้าง session ที่หมดอายุทุก 24 ชั่วโมง
  });
}

// Session Configuration
app.use(
  session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 1 วัน
    },
  })
);

// Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"], // อนุญาต CDN
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"], // อนุญาต inline style
        fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    },
  })
);

app.use(cors());

// Parse Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware สำหรับส่ง session ไปยังทุก view
app.use((req, res, next) => {
  res.locals.currentUser = req.session;
  next();
});

// Static and View Setup
app.use(express.static('public'));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Routes
app.get("/", (req, res) => {
  res.redirect("/login");
});

app.use('/', userRoutes);
app.use("/admin", adminRoutes);

// Error Middleware
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.log("Current session:", req.session);
  }
  next();
});

app.use((err, req, res, next) => {
  console.error(err.stack); // Log ข้อผิดพลาดใน console
  res.status(err.status || 500).render('error', {
    message: err.message || 'Something went wrong',
    status: err.status || 500,
    error: process.env.NODE_ENV === 'development' ? err : {}, // แสดง error stack เฉพาะในโหมด development
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
