require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const path = require('path');
const bodyParser = require('body-parser');
const { pool } = require('./config/database');
const driveService = require('./config/googleDrive');

// สร้าง express app และ router
const app = express();
const router = express.Router(); // เพิ่มบรรทัดนี้

// Import routes
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

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
    checkPeriod: 3600000 // 1 hours
  }),
  name: 'sessionId',
  resave: true,
  saveUninitialized: true,
  proxy: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 1000 // 1 hours
  }
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// เพิ่ม route สำหรับ health check
app.get('/health', async (req, res) => {
  try {
      const connection = await pool.getConnection();
      await connection.query('SELECT 1');
      connection.release();
      
      res.status(200).json({
          status: 'healthy',
          database: 'connected',
          timestamp: new Date().toISOString()
      });
  } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({
          status: 'unhealthy',
          database: 'disconnected',
          error: error.message,
          timestamp: new Date().toISOString()
      });
  }
});

// Routes
router.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect(req.session.user.role === 'admin' ? '/admin' : '/user');
  } else {
    res.render('login', { error: null });
  }
});

router.get('/login', (req, res) => {
  if (req.session.user) {
    res.redirect(req.session.user.role === 'admin' ? '/admin' : '/user');
  } else {
    res.render('login', { error: null });
  }
});

// Login route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE username = ? LIMIT 1',
      [username]
    );

    if (users.length === 0 || password !== users[0].password) {
      return res.json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    const user = users[0];
    
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      jobPosition: user.job_position
    };
    
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    res.json({ 
      success: true, 
      redirectUrl: user.role === 'admin' ? '/admin' : '/user/dashboard'
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      error: 'Server error occurred'
    });
  }
});

// Logout route
router.get('/logout', (req, res) => {
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

// ใช้ router
app.use('/', router);

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

async function initializeServices() {
  try {
      // ทดสอบ database connection
      await pool.getConnection().then(conn => {
          console.log('✅ Database connected');
          conn.release();
      });

      // initialize Google Drive service
      await driveService.initialize();
      
      return true;
  } catch (error) {
      console.error('❌ Failed to initialize services:', error);
      return false;
  }
}

// แยกการ start server ออกมา
function startServer() {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
  }).on('error', (error) => {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
  });
}

// Main initialization function
async function initializeApp() {
  try {
      // Initialize services first
      const servicesInitialized = await initializeServices();
      if (!servicesInitialized) {
          throw new Error('Failed to initialize services');
      }

      // Start server after services are ready
      startServer();
  } catch (error) {
      console.error('❌ Application initialization failed:', error);
      process.exit(1);
  }
}

// Start the application
initializeApp();