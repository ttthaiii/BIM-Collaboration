require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const path = require('path');
const bodyParser = require('body-parser');
const { pool } = require('./config/database');

// Import routes
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

const app = express();

// Trust proxy (จำเป็นสำหรับ HTTPS บน Railway)
app.set('trust proxy', 1);

// Basic middleware
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session Configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  store: new MemoryStore({
    checkPeriod: 86400000 // 24 hours
  }),
  name: 'sessionId',
  resave: true,
  saveUninitialized: true,
  proxy: true, // เพิ่มการรองรับ proxy
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // ใช้ HTTPS ใน production
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect(req.session.user.role === 'admin' ? '/admin' : '/user');
  } else {
    res.render('login', { error: null });
  }
});

app.get('/login', (req, res) => {
  if (req.session.user) {
    res.redirect(req.session.user.role === 'admin' ? '/admin' : '/user');
  } else {
    res.render('login', { error: null });
  }
});

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE username = ? LIMIT 1',
      [username]
    );

    if (rows.length > 0 && password === rows[0].password) {
      const user = rows[0];
      
      // บันทึกข้อมูลใน session
      req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role
      };
      
      // บันทึก session แบบ explicit
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ error: 'Session error' });
        }
        
        console.log('Login successful, session:', req.session);
        res.json({ 
          success: true, 
          redirectUrl: user.role === 'admin' ? '/admin' : '/user/dashboard'
        });
      });
    } else {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});
// Logout route
app.get('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) console.error('Logout error:', err);
      res.clearCookie('sessionId');
      res.redirect('/login');
    });
  } else {
    res.redirect('/login');
  }
});

// Mount routes
app.use('/admin', adminRoutes);
app.use('/user', userRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).render('error', {
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;