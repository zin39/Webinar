const express = require('express');
const crypto = require('crypto');
const prisma = require('../config/db');
const { ensureAuthenticated } = require('../middleware/auth');
const { getAnalyticsSummary } = require('../middleware/analytics');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Config file path for site settings
const CONFIG_PATH = path.join(__dirname, '../config/site-settings.json');

// Valid OG image filename pattern (only our generated filenames)
const VALID_OG_IMAGE_PATTERN = /^og-share-\d+\.(png|jpg|jpeg)$/i;

// Image magic bytes for validation
const IMAGE_SIGNATURES = {
  jpeg: Buffer.from([0xFF, 0xD8, 0xFF]),
  png: Buffer.from([0x89, 0x50, 0x4E, 0x47])
};

// Validate ogImage filename to prevent path traversal
function isValidOgImageFilename(filename) {
  if (!filename || typeof filename !== 'string') return false;

  // Must not contain path separators or traversal
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return false;
  }

  // Must match our expected pattern
  if (!VALID_OG_IMAGE_PATTERN.test(filename)) {
    return false;
  }

  // Double-check: basename must equal original (no directory components)
  if (path.basename(filename) !== filename) {
    return false;
  }

  return true;
}

// Validate file magic bytes to ensure it's actually an image
function validateImageMagicBytes(filePath) {
  try {
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    const hex = buffer.toString('hex').toLowerCase();

    // Check JPEG (FFD8FF)
    if (hex.startsWith('ffd8ff')) return 'jpeg';

    // Check PNG (89504E47)
    if (hex.startsWith('89504e47')) return 'png';

    return false;
  } catch (err) {
    console.error('Error validating magic bytes:', err);
    return false;
  }
}

// Helper to get site settings (with validation)
function getSiteSettings() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const settings = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

      // SECURITY: Validate ogImage on read to prevent path traversal
      if (settings.ogImage && !isValidOgImageFilename(settings.ogImage)) {
        console.warn('Invalid ogImage filename detected in settings, resetting to null');
        settings.ogImage = null;
      }

      // Validate timestamp
      if (settings.ogImageUpdatedAt && typeof settings.ogImageUpdatedAt !== 'number') {
        settings.ogImageUpdatedAt = null;
      }

      return settings;
    }
  } catch (err) {
    console.error('Error reading site settings:', err);
  }
  return { ogImage: null };
}

// Helper to save site settings (with validation)
function saveSiteSettings(settings) {
  try {
    // SECURITY: Validate before saving
    const sanitized = { ...settings };

    if (sanitized.ogImage && !isValidOgImageFilename(sanitized.ogImage)) {
      console.warn('Attempted to save invalid ogImage filename, rejecting');
      return false;
    }

    const configDir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(sanitized, null, 2));
    return true;
  } catch (err) {
    console.error('Error saving site settings:', err);
    return false;
  }
}

// Configure multer for OG image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../public/images');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Use timestamp to ensure unique filename and cache busting
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `og-share-${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG and JPG images are allowed'));
    }
  }
});

// Escape CSV fields to prevent formula injection
function escapeCSV(field) {
  if (field === null || field === undefined) return '';
  const str = String(field);
  // Prefix with single quote if starts with formula characters
  if (/^[=+\-@\t\r]/.test(str)) {
    return `"'${str.replace(/"/g, '""')}"`;
  }
  // Escape quotes and wrap in quotes if contains special chars
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Count responses by field value for analytics
function countByField(responses, field) {
  const counts = {};
  responses.forEach(r => {
    const value = r[field] || 'Not provided';
    counts[value] = (counts[value] || 0) + 1;
  });
  return counts;
}

// Compute analytics for survey responses
function computeSurveyAnalytics(responses) {
  const preResponses = responses.filter(r => r.surveyType === 'pre-webinar');
  const postResponses = responses.filter(r => r.surveyType === 'post-webinar');

  return {
    pre: {
      knowledgeLevel: countByField(preResponses, 'knowledgeLevel'),
      academicStress: countByField(preResponses, 'academicStress'),
      comfortLevel: countByField(preResponses, 'comfortLevel'),
      knowsResources: countByField(preResponses, 'knowsResources'),
    },
    post: {
      satisfaction: countByField(postResponses, 'satisfaction'),
      knowledgeLevelAfter: countByField(postResponses, 'knowledgeLevelAfter'),
      contentRelevance: countByField(postResponses, 'contentRelevance'),
      facilitatorRating: countByField(postResponses, 'facilitatorRating'),
      learnedStrategies: countByField(postResponses, 'learnedStrategies'),
      comfortLevelAfter: countByField(postResponses, 'comfortLevelAfter'),
      knowsResourcesAfter: countByField(postResponses, 'knowsResourcesAfter'),
      wouldRecommend: countByField(postResponses, 'wouldRecommend'),
    },
    comparison: {
      knowledgeBefore: countByField(preResponses, 'knowledgeLevel'),
      knowledgeAfter: countByField(postResponses, 'knowledgeLevelAfter'),
    }
  };
}

module.exports = function(csrfProtection) {
  const router = express.Router();

  // Apply auth middleware to all admin routes
  router.use(ensureAuthenticated);

  // Dashboard
  router.get('/', async (req, res) => {
    const attendees = await prisma.attendee.findMany({
      orderBy: { registeredAt: 'desc' }
    });

    // Get all survey responses for status tracking
    const surveyResponses = await prisma.surveyResponse.findMany({
      select: { id: true, email: true, surveyType: true, submittedAt: true }
    });

    // Create lookup map: email → { pre: response|null, post: response|null }
    const surveyStatusMap = {};
    surveyResponses.forEach(response => {
      if (!surveyStatusMap[response.email]) {
        surveyStatusMap[response.email] = { pre: null, post: null };
      }
      if (response.surveyType === 'pre-webinar') {
        surveyStatusMap[response.email].pre = response;
      } else if (response.surveyType === 'post-webinar') {
        surveyStatusMap[response.email].post = response;
      }
    });

    // Count survey submissions
    const preSurveyCount = surveyResponses.filter(r => r.surveyType === 'pre-webinar').length;
    const postSurveyCount = surveyResponses.filter(r => r.surveyType === 'post-webinar').length;

    const stats = {
      total: attendees.length,
      today: attendees.filter(a => {
        const today = new Date();
        const regDate = new Date(a.registeredAt);
        return regDate.toDateString() === today.toDateString();
      }).length,
      emailsSent: attendees.filter(a => a.emailSent).length,
      preSurveys: preSurveyCount,
      postSurveys: postSurveyCount
    };

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      attendees,
      stats,
      surveyStatusMap
    });
  });

  // Export attendees as CSV (with injection protection)
  router.get('/export', async (req, res) => {
    const attendees = await prisma.attendee.findMany({
      orderBy: { registeredAt: 'desc' }
    });

    const csv = [
      ['Name', 'Email', 'Company', 'Job Title', 'Phone', 'How They Heard', 'Registered At', 'Email Sent'].join(','),
      ...attendees.map(a => [
        escapeCSV(a.name),
        escapeCSV(a.email),
        escapeCSV(a.company),
        escapeCSV(a.jobTitle),
        escapeCSV(a.phone),
        escapeCSV(a.howHeard),
        escapeCSV(a.registeredAt.toISOString()),
        a.emailSent ? 'Yes' : 'No'
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=attendees.csv');
    res.send(csv);
  });

  // Delete attendee with CSRF
  router.post('/attendee/:id/delete', csrfProtection, async (req, res) => {
    try {
      await prisma.attendee.delete({
        where: { id: req.params.id }
      });
      req.flash('success_msg', 'Attendee removed');
    } catch (error) {
      req.flash('error_msg', 'Failed to remove attendee');
    }
    res.redirect('/admin');
  });

  // Resend confirmation email with CSRF
  router.post('/attendee/:id/resend', csrfProtection, async (req, res) => {
    try {
      let attendee = await prisma.attendee.findUnique({
        where: { id: req.params.id }
      });

      if (attendee) {
        const { sendConfirmationEmail } = require('../utils/email');
        const { generateCalendarLinks } = require('../utils/calendar');

        // Generate survey token if attendee doesn't have one
        if (!attendee.surveyToken) {
          const surveyToken = crypto.randomBytes(32).toString('hex');
          attendee = await prisma.attendee.update({
            where: { id: attendee.id },
            data: { surveyToken }
          });
        }

        // Get webinar config
        const webinar = await prisma.webinarConfig.findFirst({ where: { isActive: true } }) || {
          title: 'Webinar',
          date: new Date(process.env.WEBINAR_DATE || '2025-12-01T14:00:00Z'),
          duration: 60,
          meetingLink: process.env.WEBINAR_MEETING_LINK || '#'
        };

        const calendarLinks = generateCalendarLinks(webinar);
        await sendConfirmationEmail(attendee, webinar, calendarLinks);

        req.flash('success_msg', 'Confirmation email resent');
      }
    } catch (error) {
      console.error('Resend error:', error);
      req.flash('error_msg', 'Failed to resend email');
    }
    res.redirect('/admin');
  });

  // Analytics dashboard
  router.get('/analytics', async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 7;
      const analytics = await getAnalyticsSummary(days);

      res.render('admin/analytics', {
        title: 'Site Analytics',
        analytics,
        days
      });
    } catch (error) {
      console.error('Analytics error:', error);
      req.flash('error_msg', 'Failed to load analytics');
      res.redirect('/admin');
    }
  });

  // Email logs
  router.get('/emails', async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 50;
      const skip = (page - 1) * limit;
      const statusFilter = req.query.status || 'all';
      const typeFilter = req.query.type || 'all';

      // Build where clause
      const where = {};
      if (statusFilter !== 'all') {
        where.status = statusFilter;
      }
      if (typeFilter !== 'all') {
        where.type = typeFilter;
      }

      // Get total count for pagination
      const totalCount = await prisma.emailLog.count({ where });
      const totalPages = Math.ceil(totalCount / limit);

      // Get email logs
      const emailLogs = await prisma.emailLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit
      });

      // Get stats
      const stats = {
        total: await prisma.emailLog.count(),
        sent: await prisma.emailLog.count({ where: { status: 'sent' } }),
        failed: await prisma.emailLog.count({ where: { status: 'failed' } }),
        skipped: await prisma.emailLog.count({ where: { status: 'skipped' } })
      };

      res.render('admin/emails', {
        title: 'Email Logs',
        emailLogs,
        stats,
        page,
        totalPages,
        totalCount,
        statusFilter,
        typeFilter
      });
    } catch (error) {
      console.error('Email logs error:', error);

      // Check if table doesn't exist
      if (error.code === 'P2021' || error.message.includes('does not exist')) {
        return res.render('admin/emails', {
          title: 'Email Logs',
          emailLogs: [],
          stats: { total: 0, sent: 0, failed: 0, skipped: 0 },
          page: 1,
          totalPages: 0,
          totalCount: 0,
          statusFilter: 'all',
          typeFilter: 'all',
          migrationNeeded: true
        });
      }

      req.flash('error_msg', 'Failed to load email logs');
      res.redirect('/admin');
    }
  });

  // Settings page
  router.get('/settings', csrfProtection, (req, res) => {
    const settings = getSiteSettings();
    res.render('admin/settings', {
      title: 'Site Settings',
      ogImage: settings.ogImage
    });
  });

  // Upload OG image
  // Note: For multipart/form-data, we need to run multer FIRST to parse the body,
  // then manually check CSRF token since req.body isn't available before multer runs
  router.post('/settings/og-image', (req, res, next) => {
    upload.single('ogImage')(req, res, function (err) {
      // SECURITY: Manually validate CSRF token after multer parses the form
      const csrfToken = req.body && req.body._csrf;
      if (!csrfToken) {
        req.flash('error_msg', 'Security token missing. Please try again.');
        return res.redirect('/admin/settings');
      }

      // Validate CSRF token using the session
      try {
        csrfProtection(req, res, (csrfErr) => {
          if (csrfErr) {
            req.flash('error_msg', 'Security token invalid. Please refresh and try again.');
            return res.redirect('/admin/settings');
          }
          handleUpload(req, res, err);
        });
      } catch (csrfError) {
        req.flash('error_msg', 'Security validation failed. Please try again.');
        return res.redirect('/admin/settings');
      }
    });
  });

  // Extracted upload handler function
  function handleUpload(req, res, err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          req.flash('error_msg', 'File is too large. Maximum size is 5MB.');
        } else {
          // SECURITY: Use generic error message to avoid information leakage
          req.flash('error_msg', 'Upload failed. Please try again with a valid image.');
        }
        return res.redirect('/admin/settings');
      } else if (err) {
        // SECURITY: Use generic error message
        req.flash('error_msg', 'Invalid file type. Only PNG and JPG images are allowed.');
        return res.redirect('/admin/settings');
      }

      if (!req.file) {
        req.flash('error_msg', 'Please select an image to upload');
        return res.redirect('/admin/settings');
      }

      try {
        // SECURITY: Validate magic bytes to ensure file is actually an image
        const imageType = validateImageMagicBytes(req.file.path);
        if (!imageType) {
          // Delete the uploaded file - it's not a valid image
          fs.unlinkSync(req.file.path);
          req.flash('error_msg', 'Invalid image file. The file does not appear to be a valid PNG or JPEG image.');
          return res.redirect('/admin/settings');
        }

        // SECURITY: Validate that our generated filename is safe
        if (!isValidOgImageFilename(req.file.filename)) {
          fs.unlinkSync(req.file.path);
          req.flash('error_msg', 'Upload failed due to invalid filename.');
          return res.redirect('/admin/settings');
        }

        const settings = getSiteSettings();

        // SECURITY: Delete old OG image only if filename passes validation
        if (settings.ogImage && isValidOgImageFilename(settings.ogImage)) {
          const oldPath = path.join(__dirname, '../public/images', settings.ogImage);

          // SECURITY: Verify the resolved path is within the images directory
          const imagesDir = path.resolve(__dirname, '../public/images');
          const resolvedOldPath = path.resolve(oldPath);

          if (resolvedOldPath.startsWith(imagesDir) && fs.existsSync(resolvedOldPath)) {
            fs.unlinkSync(resolvedOldPath);
          }
        }

        // Save new filename
        settings.ogImage = req.file.filename;
        settings.ogImageUpdatedAt = Date.now();

        if (!saveSiteSettings(settings)) {
          req.flash('error_msg', 'Failed to save image settings');
          return res.redirect('/admin/settings');
        }

        req.flash('success_msg', 'OG image uploaded successfully! Remember to clear social media caches for the changes to take effect.');
        res.redirect('/admin/settings');
      } catch (error) {
        console.error('Error saving OG image settings:', error);
        req.flash('error_msg', 'Failed to save image settings');
        res.redirect('/admin/settings');
      }
  }

  // Survey responses
  router.get('/surveys', async (req, res) => {
    try {
      const surveyType = req.query.type || 'all';

      const where = {};
      if (surveyType !== 'all') {
        where.surveyType = surveyType;
      }

      // Get filtered responses for table display
      const responses = await prisma.surveyResponse.findMany({
        where,
        orderBy: { submittedAt: 'desc' }
      });

      // Get all responses for analytics (unfiltered)
      const allResponses = await prisma.surveyResponse.findMany();
      const analytics = computeSurveyAnalytics(allResponses);

      const stats = {
        total: await prisma.surveyResponse.count(),
        preWebinar: await prisma.surveyResponse.count({ where: { surveyType: 'pre-webinar' } }),
        postWebinar: await prisma.surveyResponse.count({ where: { surveyType: 'post-webinar' } })
      };

      res.render('admin/surveys', {
        title: 'Survey Responses',
        responses,
        stats,
        surveyType,
        analytics
      });
    } catch (error) {
      console.error('Survey responses error:', error);

      // Check if table doesn't exist
      if (error.code === 'P2021' || error.message.includes('does not exist')) {
        return res.render('admin/surveys', {
          title: 'Survey Responses',
          responses: [],
          stats: { total: 0, preWebinar: 0, postWebinar: 0 },
          surveyType: 'all',
          migrationNeeded: true,
          analytics: { pre: {}, post: {}, comparison: {} }
        });
      }

      req.flash('error_msg', 'Failed to load survey responses');
      res.redirect('/admin');
    }
  });

  // View individual survey response detail
  router.get('/surveys/:id', async (req, res) => {
    try {
      const response = await prisma.surveyResponse.findUnique({
        where: { id: req.params.id }
      });

      if (!response) {
        req.flash('error_msg', 'Survey response not found');
        return res.redirect('/admin/surveys');
      }

      res.render('admin/survey-detail', {
        title: 'Survey Response',
        response
      });
    } catch (error) {
      console.error('Error fetching survey response:', error);
      req.flash('error_msg', 'Failed to load survey response');
      res.redirect('/admin/surveys');
    }
  });

  // Export survey responses as CSV
  router.get('/surveys/export', async (req, res) => {
    try {
      const surveyType = req.query.type || 'all';

      const where = {};
      if (surveyType !== 'all') {
        where.surveyType = surveyType;
      }

      const responses = await prisma.surveyResponse.findMany({
        where,
        orderBy: { submittedAt: 'desc' }
      });

      const headers = ['Email', 'Name', 'Survey Type', 'Knowledge Level', 'Academic Stress', 'Comfort Level', 'Knows Resources', 'Hopes To Learn', 'Satisfaction', 'Knowledge After', 'Content Relevance', 'Facilitator Rating', 'Learned Strategies', 'Comfort After', 'Knows Resources After', 'Most Valuable', 'Improvements', 'Would Recommend', 'Submitted At'];

      const csv = [
        headers.join(','),
        ...responses.map(r => [
          escapeCSV(r.email),
          escapeCSV(r.name),
          escapeCSV(r.surveyType),
          escapeCSV(r.knowledgeLevel),
          escapeCSV(r.academicStress),
          r.comfortLevel || '',
          escapeCSV(r.knowsResources),
          escapeCSV(r.hopesToLearn),
          escapeCSV(r.satisfaction),
          escapeCSV(r.knowledgeLevelAfter),
          r.contentRelevance || '',
          r.facilitatorRating || '',
          escapeCSV(r.learnedStrategies),
          escapeCSV(r.comfortLevelAfter),
          escapeCSV(r.knowsResourcesAfter),
          escapeCSV(r.mostValuable),
          escapeCSV(r.improvements),
          escapeCSV(r.wouldRecommend),
          escapeCSV(r.submittedAt.toISOString())
        ].join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=survey-responses-${surveyType}.csv`);
      res.send(csv);
    } catch (error) {
      console.error('Survey export error:', error);
      req.flash('error_msg', 'Failed to export survey responses');
      res.redirect('/admin/surveys');
    }
  });

  return router;
};
