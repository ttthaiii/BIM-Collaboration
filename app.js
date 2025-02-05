require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const path = require('path');
const bodyParser = require('body-parser');
const { pool } = require('./config/database');

// Import routes
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

const app = express();

// Session Configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  store: new MemoryStore({ 
    checkPeriod: 86400000 
  }),
  cookie: {
    secure: false, // set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 
  }
}));

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Basic routes
app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    if (req.session.user.role === 'admin') {
      res.redirect('/admin');
    } else {
      res.redirect('/user');
    }
  } else {
    res.render('login', { error: null });
  }
});

app.get('/login', (req, res) => {
  if (req.session && req.session.user) {
    if (req.session.user.role === 'admin') {
      res.redirect('/admin');
    } else {
      res.redirect('/user');
    }
  } else {
    res.render('login', { error: null });
  }
});

// Login route with database authentication
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
      console.log('Login attempt:', { username });
      
      const [rows] = await pool.execute(
          'SELECT * FROM users WHERE username = ? LIMIT 1',
          [username]
      );

      if (rows.length > 0) {
          const user = rows[0];
          
          if (password === user.password) {  // เช็ครหัสผ่านแบบ plain text
              req.session.user = {
                  id: user.id,
                  username: user.username,
                  role: user.role,
                  job_position: user.job_position
              };

              console.log('User logged in:', req.session.user);

              if (user.role === 'admin') {
                  return res.redirect('/admin');
              } else {
                  return res.redirect('/user');
              }
          }
      }
      
      res.render('login', { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  } catch (err) {
      console.error('Login error:', err);
      res.render('login', { error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Mount routes - order matters!
app.use('/admin', adminRoutes);
app.use('/user', userRoutes);

// 404 Error Handler
app.use((req, res, next) => {
  res.status(404).render('error', {
    message: 'Route not found',
    error: { status: 404 }
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).render('error', {
    message: err.message || 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;