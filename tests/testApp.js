/**
 * Test App Setup
 * Creates an Express app instance for testing
 */
require('dotenv').config({ path: '.env.test' });

const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { csrfSync } = require('csrf-sync');

function createTestApp() {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: false, // Disable for testing
  }));

  app.disable('x-powered-by');

  // Rate limiting (relaxed for tests)
  const authLimiter = rateLimit({
    windowMs: parseInt(process.env.LOGIN_WINDOW_MS) || 60000,
    max: parseInt(process.env.LOGIN_MAX_ATTEMPTS) || 100,
    standardHeaders: true,
    legacyHeaders: false,
  });

  const registerLimiter = rateLimit({
    windowMs: parseInt(process.env.REGISTER_WINDOW_MS) || 60000,
    max: parseInt(process.env.REGISTER_MAX_ATTEMPTS) || 100,
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Passport config
  require('../config/passport')(passport);

  // View engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));

  // Static files
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Body parser
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(express.json({ limit: '10kb' }));

  // Session
  app.use(session({
    secret: process.env.SESSION_SECRET || 'test-secret',
    name: 'sessionId',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: false,
      sameSite: 'lax'
    }
  }));

  // CSRF Protection
  const { csrfSynchronisedProtection, generateToken } = csrfSync({
    getTokenFromRequest: (req) => req.body._csrf || req.query._csrf,
    size: 64,
  });

  app.use((req, res, next) => {
    res.locals.csrfToken = generateToken(req);
    next();
  });

  // Passport middleware
  app.use(passport.initialize());
  app.use(passport.session());

  // Flash messages
  app.use(flash());

  // Global variables
  app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.user = req.user || null;
    next();
  });

  // Routes
  app.use('/', require('../routes/index')(registerLimiter, csrfSynchronisedProtection));
  app.use('/auth', require('../routes/auth')(authLimiter, csrfSynchronisedProtection));
  app.use('/admin', require('../routes/admin')(csrfSynchronisedProtection));
  app.use('/api', require('../routes/api'));

  // Error handlers
  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  app.use((err, req, res, next) => {
    res.status(500).json({ error: err.message });
  });

  return app;
}

module.exports = createTestApp;
