const winston = require('winston');
const path = require('path');
const prisma = require('../config/db');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for console
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `[${timestamp}] ${level}: ${message} ${metaStr}`;
  })
);

// Custom format for files
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

// Create Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    // Console output
    new winston.transports.Console({
      format: consoleFormat
    }),
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Log error to database
const logErrorToDb = async (level, message, details = {}) => {
  try {
    await prisma.errorLog.create({
      data: {
        level,
        message: String(message).substring(0, 1000),
        stack: details.stack?.substring(0, 5000),
        path: details.path,
        method: details.method,
        ip: details.ip,
        userAgent: details.userAgent?.substring(0, 500),
        userId: details.userId,
        metadata: details.metadata ? JSON.stringify(details.metadata) : null
      }
    });
  } catch (err) {
    // Don't throw, just log to console
    console.error('Failed to log error to database:', err.message);
  }
};

// Extended logger with database logging for errors
const extendedLogger = {
  info: (message, meta = {}) => logger.info(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  debug: (message, meta = {}) => logger.debug(message, meta),
  
  error: async (message, details = {}) => {
    logger.error(message, details);
    await logErrorToDb('error', message, details);
  },
  
  // Log HTTP request errors
  httpError: async (err, req) => {
    const details = {
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
      userId: req.user?.id,
      metadata: {
        query: req.query,
        body: req.body ? '***REDACTED***' : undefined
      }
    };
    logger.error(err.message, details);
    await logErrorToDb('error', err.message, details);
  }
};

module.exports = extendedLogger;
