const express = require('express');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { forwardAuthenticated } = require('../middleware/auth');

module.exports = function(authLimiter, csrfProtection) {
  const router = express.Router();

  // Login page
  router.get('/login', forwardAuthenticated, (req, res) => {
    res.render('auth/login', {
      title: 'Admin Login'
    });
  });

  // Login handler with rate limiting and CSRF
  router.post('/login', authLimiter, csrfProtection, (req, res, next) => {
    passport.authenticate('local', {
      successRedirect: '/admin',
      failureRedirect: '/auth/login',
      failureFlash: true
    })(req, res, next);
  });

  // Logout
  router.get('/logout', (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.flash('success_msg', 'You are logged out');
      res.redirect('/auth/login');
    });
  });

  // Setup page (only works if no admin exists)
  router.get('/setup', async (req, res) => {
    const adminExists = await prisma.user.findFirst();
    if (adminExists) {
      req.flash('error_msg', 'Admin already exists');
      return res.redirect('/auth/login');
    }
    res.render('auth/setup', {
      title: 'Create Admin Account',
      errors: [],
      formData: {}
    });
  });

  // Create first admin with CSRF protection
  router.post('/setup', csrfProtection, [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
      .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
      .matches(/[0-9]/).withMessage('Password must contain a number'),
    body('password2').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
  ], async (req, res) => {
    // Check if admin already exists
    const adminExists = await prisma.user.findFirst();
    if (adminExists) {
      req.flash('error_msg', 'Admin already exists');
      return res.redirect('/auth/login');
    }

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.render('auth/setup', {
        title: 'Create Admin Account',
        errors: errors.array(),
        formData: req.body
      });
    }

    try {
      const hashedPassword = await bcrypt.hash(req.body.password, 12); // Increased from 10

      await prisma.user.create({
        data: {
          name: req.body.name,
          email: req.body.email.toLowerCase(),
          password: hashedPassword,
          role: 'admin'
        }
      });

      req.flash('success_msg', 'Admin account created. You can now log in.');
      res.redirect('/auth/login');
    } catch (error) {
      console.error('Setup error:', error);
      res.render('auth/setup', {
        title: 'Create Admin Account',
        errors: [{ msg: 'Something went wrong. Please try again.' }],
        formData: req.body
      });
    }
  });

  return router;
};
