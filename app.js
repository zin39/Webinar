require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { csrfSync } = require('csrf-sync');
const morgan = require('morgan');
const fs = require('fs');
const logger = require('./utils/logger');
const { analyticsMiddleware } = require('./middleware/analytics');

// Valid OG image filename pattern (only our generated filenames)
const VALID_OG_IMAGE_PATTERN = /^og-share-\d+\.(png|jpg|jpeg)$/i;

// SECURITY: Validate ogImage filename to prevent path traversal
function isValidOgImageFilename(filename) {
  if (!filename || typeof filename !== 'string') return false;
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) return false;
  if (!VALID_OG_IMAGE_PATTERN.test(filename)) return false;
  if (path.basename(filename) !== filename) return false;
  return true;
}

// Helper to get site settings for OG image (with security validation)
function getSiteSettings() {
  try {
    const configPath = path.join(__dirname, 'config/site-settings.json');
    if (fs.existsSync(configPath)) {
      const settings = JSON.parse(fs.readFileSync(configPath, 'utf8'));

      // SECURITY: Validate ogImage filename on read
      if (settings.ogImage && !isValidOgImageFilename(settings.ogImage)) {
        console.warn('Invalid ogImage filename in settings, ignoring');
        settings.ogImage = null;
      }

      return settings;
    }
  } catch (err) {
    console.error('Error reading site settings:', err);
  }
  return { ogImage: null };
}

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Trust proxy if behind reverse proxy (nginx, etc.)
if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Disable X-Powered-By header
app.disable('x-powered-by');

// Rate limiting with env config
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.LOGIN_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.LOGIN_MAX_ATTEMPTS) || 5,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    res.status(429).render('error', {
      title: 'Too Many Requests',
      message: 'Too many login attempts. Please try again after 15 minutes.'
    });
  }
});

const registerLimiter = rateLimit({
  windowMs: parseInt(process.env.REGISTER_WINDOW_MS) || 60 * 60 * 1000,
  max: parseInt(process.env.REGISTER_MAX_ATTEMPTS) || 10,
  message: { error: 'Too many registrations from this IP' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const webinar = { title: 'Webinar' };
    res.status(429).render('register', {
      title: 'Register',
      webinar,
      errors: [{ msg: 'Too many registration attempts. Please try again later.' }],
      formData: req.body
    });
  }
});

// Global rate limiter for all routes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Passport config
require('./config/passport')(passport);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files with cache control
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: isProduction ? '1d' : 0,
  etag: true
}));

// Body parser with size limits
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(express.json({ limit: '10kb' }));

// HTTP request logging with Morgan
const morganFormat = isProduction ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  stream: {
    write: (message) => logger.info(message.trim())
  },
  skip: (req) => req.path.startsWith('/css') || req.path.startsWith('/js') || req.path.startsWith('/images')
}));

// Session with secure settings
app.use(session({
  secret: process.env.SESSION_SECRET,
  name: 'sessionId', // Don't use default 'connect.sid'
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax'
  }
}));

// CSRF Protection
const { csrfSynchronisedProtection, generateToken } = csrfSync({
  getTokenFromRequest: (req) => req.body._csrf || req.query._csrf,
  size: 64,
});

// Make CSRF token available to all views
app.use((req, res, next) => {
  res.locals.csrfToken = generateToken(req);
  next();
});

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Flash messages
app.use(flash());

// Global variables for templates
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.user || null;
  res.locals.siteUrl = process.env.SITE_URL || `http://localhost:${process.env.PORT || 3000}`;

  // Add OG image settings for social sharing
  const siteSettings = getSiteSettings();
  res.locals.ogImage = siteSettings.ogImage;
  res.locals.ogImageTimestamp = siteSettings.ogImageUpdatedAt || Date.now();

  next();
});

// Analytics middleware - track page views
app.use(analyticsMiddleware);

// Routes with rate limiting
app.use('/', require('./routes/index')(registerLimiter, csrfSynchronisedProtection));
app.use('/auth', require('./routes/auth')(authLimiter, csrfSynchronisedProtection));
app.use('/admin', require('./routes/admin')(csrfSynchronisedProtection));
app.use('/api', require('./routes/api'));

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Error handler - don't leak error details in production
app.use((err, req, res, next) => {
  // Log error using Winston logger (also saves to database)
  logger.httpError(err, req);

  // Handle CSRF errors
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).render('error', {
      title: 'Forbidden',
      message: 'Invalid or missing security token. Please refresh and try again.'
    });
  }

  res.status(500).render('error', {
    title: 'Error',
    message: isProduction ? 'Something went wrong' : err.message
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║         Webinar Registration Server               ║
╠═══════════════════════════════════════════════════╣
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(33)} ║
║  Port: ${String(PORT).padEnd(40)} ║
║  URL: http://localhost:${String(PORT).padEnd(25)} ║
╚═══════════════════════════════════════════════════╝
  `);
});
