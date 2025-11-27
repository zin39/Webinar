const express = require('express');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const prisma = require('../config/db');
const { sendConfirmationEmail } = require('../utils/email');
const { generateCalendarLinks } = require('../utils/calendar');
const path = require('path');
const fs = require('fs');

// Helper to get site settings for OG image
function getSiteSettings() {
  try {
    const configPath = path.join(__dirname, '../config/site-settings.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading site settings:', err);
  }
  return { ogImage: null };
}

// Valid OG image filename pattern
const VALID_OG_IMAGE_PATTERN = /^og-share-\d+\.(png|jpg|jpeg)$/i;

// Webinar config (can be loaded from DB or env)
const getWebinarConfig = async () => {
  try {
    const config = await prisma.webinarConfig.findFirst({
      where: { isActive: true }
    });
    if (config) return config;
  } catch (e) {
    // DB might not be set up yet, use defaults
  }

  return {
    title: 'Student Mental Health: Thriving Beyond Grades',
    subtitle: 'An honest conversation about academic stress and practical strategies to thrive',
    description: 'Feeling overwhelmed by exams, assignments, and expectations? You\'re not alone. Join us for an honest conversation about student mental health, academic stress, and practical strategies to thrive beyond just grades. Learn how to balance success with wellbeing, recognize when to ask for help, and build resilience for your academic journey. Whether you\'re a student facing pressure, a parent wanting to support your child, or an educator concerned about student wellness - this session is for you.',
    date: new Date(process.env.WEBINAR_DATE || '2025-11-30T12:30:00Z'),
    duration: 60,
    meetingLink: process.env.WEBINAR_MEETING_LINK || '',
    meetingLinkPending: !process.env.WEBINAR_MEETING_LINK,
    speakerName: 'Dr. Aditi Pajiyar',
    speakerBio: 'Fellow in Mental Health Leadership at NHAFN (National Health Authority Foundation Network). Part of NHAFN Community Advocacy Project - Mental Health Leadership Program Cohort 1. Passionate about breaking mental health stigma and supporting student wellbeing.',
    speakerImage: '/images/speaker.jpeg'
  };
};

module.exports = function(registerLimiter, csrfProtection) {
  const router = express.Router();

  // Dedicated OG image route with no-cache headers for social media crawlers
  router.get('/og-image.png', (req, res) => {
    const settings = getSiteSettings();
    const DEFAULT_IMAGE = 'webinar-share-nov2024.png';

    // Determine which image to serve
    let imagePath;
    let imageFile;

    if (settings.ogImage && VALID_OG_IMAGE_PATTERN.test(settings.ogImage)) {
      imageFile = settings.ogImage;
      imagePath = path.join(__dirname, '../public/images', imageFile);
    }

    // Check if the uploaded image exists, otherwise fallback to default
    if (!imagePath || !fs.existsSync(imagePath)) {
      imageFile = DEFAULT_IMAGE;
      imagePath = path.join(__dirname, '../public/images', DEFAULT_IMAGE);
    }

    // Final check - if even default doesn't exist, return 404
    if (!fs.existsSync(imagePath)) {
      return res.status(404).send('OG image not found');
    }

    // Set headers for social media crawlers
    res.set({
      'Cache-Control': 'public, max-age=3600',  // Allow caching for 1 hour
      'Cross-Origin-Resource-Policy': 'cross-origin',  // Allow LinkedIn/Facebook to fetch
      'Access-Control-Allow-Origin': '*',  // Allow any origin to access
      'X-Content-Type-Options': 'nosniff'
    });

    // Determine content type
    const ext = path.extname(imagePath).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
    res.type(contentType);

    // Send the file
    res.sendFile(imagePath);
  });

  // Landing page
  router.get('/', async (req, res) => {
    const webinar = await getWebinarConfig();
    const BASE_ATTENDEE_COUNT = 11; // Initial count before website launch
    const actualCount = await prisma.attendee.count().catch(() => 0);
    const attendeeCount = BASE_ATTENDEE_COUNT + actualCount;

    res.render('index', {
      title: webinar.title,
      webinar,
      attendeeCount
    });
  });

  // Registration page
  router.get('/register', async (req, res) => {
    const webinar = await getWebinarConfig();
    res.render('register', {
      title: 'Register - ' + webinar.title,
      webinar,
      errors: [],
      formData: {}
    });
  });

  // Handle registration with rate limiting and CSRF
  router.post('/register', registerLimiter, csrfProtection, [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }).withMessage('Name too long'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('company').optional().trim().isLength({ max: 100 }),
    body('jobTitle').optional().trim().isLength({ max: 100 }),
    body('phone').optional().trim().isLength({ max: 15 }).matches(/^[0-9]*$/).withMessage('Phone number should only contain digits'),
    body('countryCode').optional().trim().isLength({ max: 6 }),
    body('howHeard').optional().trim().isLength({ max: 50 })
  ], async (req, res) => {
    const errors = validationResult(req);
    const webinar = await getWebinarConfig();

    if (!errors.isEmpty()) {
      return res.render('register', {
        title: 'Register - ' + webinar.title,
        webinar,
        errors: errors.array(),
        formData: req.body
      });
    }

    try {
      // Check if already registered
      const existing = await prisma.attendee.findUnique({
        where: { email: req.body.email.toLowerCase() }
      });

      if (existing) {
        return res.render('register', {
          title: 'Register - ' + webinar.title,
          webinar,
          errors: [{ msg: 'This email is already registered for the webinar' }],
          formData: req.body
        });
      }

      // Combine country code with phone number
      let fullPhone = null;
      if (req.body.phone) {
        const countryCode = req.body.countryCode || '+977';
        fullPhone = `${countryCode} ${req.body.phone}`;
      }

      // Generate unique survey token
      const surveyToken = crypto.randomBytes(32).toString('hex');

      // Create attendee
      const attendee = await prisma.attendee.create({
        data: {
          name: req.body.name,
          email: req.body.email.toLowerCase(),
          company: req.body.company || null,
          jobTitle: req.body.jobTitle || null,
          phone: fullPhone,
          howHeard: req.body.howHeard || null,
          surveyToken
        }
      });

      // Generate calendar links
      const calendarLinks = generateCalendarLinks(webinar);

      // Send confirmation email (async, don't wait)
      sendConfirmationEmail(attendee, webinar, calendarLinks).catch(console.error);

      // Redirect to success page
      res.redirect(`/success?email=${encodeURIComponent(attendee.email)}`);

    } catch (error) {
      console.error('Registration error:', error);
      res.render('register', {
        title: 'Register - ' + webinar.title,
        webinar,
        errors: [{ msg: 'Something went wrong. Please try again.' }],
        formData: req.body
      });
    }
  });

  // Success page
  router.get('/success', async (req, res) => {
    const email = req.query.email;

    // Validate that email is provided and is actually registered
    if (!email) {
      return res.redirect('/register');
    }

    // Check if this email is actually registered
    const attendee = await prisma.attendee.findUnique({
      where: { email: email }
    }).catch(() => null);

    if (!attendee) {
      return res.redirect('/register');
    }

    const webinar = await getWebinarConfig();
    const calendarLinks = generateCalendarLinks(webinar);

    res.render('success', {
      title: 'Registration Successful',
      webinar,
      calendarLinks,
      email: attendee.email
    });
  });

  return router;
};
