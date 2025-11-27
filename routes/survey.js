const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const rateLimit = require('express-rate-limit');

// Rate limiter for survey submissions (5 per hour per IP)
const surveyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many survey submissions from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Token format validation (64 hex characters)
const isValidTokenFormat = (token) => {
  return token && /^[a-f0-9]{64}$/i.test(token);
};

// Max length for text fields
const MAX_TEXT_LENGTH = 1000;

// Truncate text to max length
const truncateText = (text, maxLength = MAX_TEXT_LENGTH) => {
  if (!text) return null;
  return text.substring(0, maxLength);
};

module.exports = function(csrfProtection) {
  // Pre-webinar survey page
  router.get('/pre-webinar', csrfProtection, async (req, res) => {
    const token = req.query.token || '';

    // Validate token format
    if (!isValidTokenFormat(token)) {
      return res.render('survey/invalid-token', {
        message: 'Invalid or missing survey link',
        suggestion: 'Please use the link from your confirmation email or register for the webinar.'
      });
    }

    // Look up attendee by token
    const attendee = await prisma.attendee.findUnique({
      where: { surveyToken: token }
    });

    if (!attendee) {
      return res.render('survey/invalid-token', {
        message: 'Invalid survey link',
        suggestion: 'Please use the link from your confirmation email or register for the webinar.'
      });
    }

    // Check if already submitted
    const existing = await prisma.surveyResponse.findFirst({
      where: { email: attendee.email, surveyType: 'pre-webinar' }
    });

    res.render('survey/pre-webinar', {
      email: attendee.email,
      name: attendee.name,
      token,
      alreadySubmitted: !!existing,
      error: null,
      csrfToken: res.locals.csrfToken
    });
  });

  // Submit pre-webinar survey
  router.post('/pre-webinar', surveyLimiter, csrfProtection, async (req, res) => {
    const token = req.body.token || '';

    // Validate token format
    if (!isValidTokenFormat(token)) {
      return res.render('survey/invalid-token', {
        message: 'Invalid survey submission',
        suggestion: 'Please use the link from your confirmation email.'
      });
    }

    // Look up attendee by token (IMPORTANT: use DB values, not form values)
    const attendee = await prisma.attendee.findUnique({
      where: { surveyToken: token }
    });

    if (!attendee) {
      return res.render('survey/invalid-token', {
        message: 'Invalid survey submission',
        suggestion: 'Please use the link from your confirmation email.'
      });
    }

    // Extract form data (except email/name which come from DB)
    const {
      knowledgeLevel,
      academicStress,
      comfortLevel,
      knowsResources,
      hopesToLearn
    } = req.body;

    // Server-side validation for required fields
    const errors = [];
    if (!knowledgeLevel) errors.push('Please select your knowledge level');
    if (!academicStress) errors.push('Please answer the academic stress question');
    if (!comfortLevel) errors.push('Please select your comfort level');
    if (!knowsResources) errors.push('Please answer about mental health resources');

    if (errors.length > 0) {
      return res.render('survey/pre-webinar', {
        email: attendee.email,
        name: attendee.name,
        token,
        alreadySubmitted: false,
        error: errors.join('. '),
        csrfToken: res.locals.csrfToken
      });
    }

    try {
      // Check if already submitted
      const existing = await prisma.surveyResponse.findFirst({
        where: { email: attendee.email, surveyType: 'pre-webinar' }
      });

      if (existing) {
        return res.render('survey/pre-webinar', {
          email: attendee.email,
          name: attendee.name,
          token,
          alreadySubmitted: true,
          error: null,
          csrfToken: res.locals.csrfToken
        });
      }

      // Create survey response (use attendee email/name from DB to prevent tampering)
      await prisma.surveyResponse.create({
        data: {
          email: attendee.email,
          name: attendee.name,
          surveyType: 'pre-webinar',
          knowledgeLevel,
          academicStress,
          comfortLevel: comfortLevel ? parseInt(comfortLevel) : null,
          knowsResources,
          hopesToLearn: truncateText(hopesToLearn)
        }
      });

      res.render('survey/thank-you', { surveyType: 'pre-webinar' });
    } catch (error) {
      console.error('Survey submission error:', error);
      res.render('survey/pre-webinar', {
        email: attendee.email,
        name: attendee.name,
        token,
        alreadySubmitted: false,
        error: 'An error occurred. Please try again.',
        csrfToken: res.locals.csrfToken
      });
    }
  });

  // Post-webinar survey page
  router.get('/post-webinar', csrfProtection, async (req, res) => {
    const token = req.query.token || '';

    // Validate token format
    if (!isValidTokenFormat(token)) {
      return res.render('survey/invalid-token', {
        message: 'Invalid or missing survey link',
        suggestion: 'Please use the link from your post-webinar email.'
      });
    }

    // Look up attendee by token
    const attendee = await prisma.attendee.findUnique({
      where: { surveyToken: token }
    });

    if (!attendee) {
      return res.render('survey/invalid-token', {
        message: 'Invalid survey link',
        suggestion: 'Please use the link from your post-webinar email.'
      });
    }

    // Check if already submitted
    const existing = await prisma.surveyResponse.findFirst({
      where: { email: attendee.email, surveyType: 'post-webinar' }
    });

    res.render('survey/post-webinar', {
      email: attendee.email,
      name: attendee.name,
      token,
      alreadySubmitted: !!existing,
      error: null,
      csrfToken: res.locals.csrfToken
    });
  });

  // Submit post-webinar survey
  router.post('/post-webinar', surveyLimiter, csrfProtection, async (req, res) => {
    const token = req.body.token || '';

    // Validate token format
    if (!isValidTokenFormat(token)) {
      return res.render('survey/invalid-token', {
        message: 'Invalid survey submission',
        suggestion: 'Please use the link from your post-webinar email.'
      });
    }

    // Look up attendee by token (IMPORTANT: use DB values, not form values)
    const attendee = await prisma.attendee.findUnique({
      where: { surveyToken: token }
    });

    if (!attendee) {
      return res.render('survey/invalid-token', {
        message: 'Invalid survey submission',
        suggestion: 'Please use the link from your post-webinar email.'
      });
    }

    // Extract form data (except email/name which come from DB)
    const {
      satisfaction,
      knowledgeLevelAfter,
      contentRelevance,
      facilitatorRating,
      learnedStrategies,
      comfortLevelAfter,
      knowsResourcesAfter,
      mostValuable,
      improvements,
      wouldRecommend
    } = req.body;

    // Server-side validation for required fields
    const errors = [];
    if (!satisfaction) errors.push('Please rate your satisfaction');
    if (!knowledgeLevelAfter) errors.push('Please select your knowledge level');
    if (!contentRelevance) errors.push('Please rate content relevance');
    if (!facilitatorRating) errors.push('Please rate the facilitator');
    if (!learnedStrategies) errors.push('Please answer about coping strategies');
    if (!comfortLevelAfter) errors.push('Please answer about comfort level');
    if (!knowsResourcesAfter) errors.push('Please answer about resources');
    if (!wouldRecommend) errors.push('Please answer whether you would recommend');

    if (errors.length > 0) {
      return res.render('survey/post-webinar', {
        email: attendee.email,
        name: attendee.name,
        token,
        alreadySubmitted: false,
        error: errors.join('. '),
        csrfToken: res.locals.csrfToken
      });
    }

    try {
      // Check if already submitted
      const existing = await prisma.surveyResponse.findFirst({
        where: { email: attendee.email, surveyType: 'post-webinar' }
      });

      if (existing) {
        return res.render('survey/post-webinar', {
          email: attendee.email,
          name: attendee.name,
          token,
          alreadySubmitted: true,
          error: null,
          csrfToken: res.locals.csrfToken
        });
      }

      // Create survey response (use attendee email/name from DB to prevent tampering)
      await prisma.surveyResponse.create({
        data: {
          email: attendee.email,
          name: attendee.name,
          surveyType: 'post-webinar',
          satisfaction,
          knowledgeLevelAfter,
          contentRelevance: contentRelevance ? parseInt(contentRelevance) : null,
          facilitatorRating: facilitatorRating ? parseInt(facilitatorRating) : null,
          learnedStrategies,
          comfortLevelAfter,
          knowsResourcesAfter,
          mostValuable: truncateText(mostValuable),
          improvements: truncateText(improvements),
          wouldRecommend
        }
      });

      res.render('survey/thank-you', { surveyType: 'post-webinar' });
    } catch (error) {
      console.error('Survey submission error:', error);
      res.render('survey/post-webinar', {
        email: attendee.email,
        name: attendee.name,
        token,
        alreadySubmitted: false,
        error: 'An error occurred. Please try again.',
        csrfToken: res.locals.csrfToken
      });
    }
  });

  return router;
};
