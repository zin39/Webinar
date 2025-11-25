const express = require('express');
const prisma = require('../config/db');
const { ensureAuthenticated } = require('../middleware/auth');
const { getAnalyticsSummary } = require('../middleware/analytics');

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

module.exports = function(csrfProtection) {
  const router = express.Router();

  // Apply auth middleware to all admin routes
  router.use(ensureAuthenticated);

  // Dashboard
  router.get('/', async (req, res) => {
    const attendees = await prisma.attendee.findMany({
      orderBy: { registeredAt: 'desc' }
    });

    const stats = {
      total: attendees.length,
      today: attendees.filter(a => {
        const today = new Date();
        const regDate = new Date(a.registeredAt);
        return regDate.toDateString() === today.toDateString();
      }).length,
      emailsSent: attendees.filter(a => a.emailSent).length
    };

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      attendees,
      stats
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
      const attendee = await prisma.attendee.findUnique({
        where: { id: req.params.id }
      });

      if (attendee) {
        const { sendConfirmationEmail } = require('../utils/email');
        const { generateCalendarLinks } = require('../utils/calendar');

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

  return router;
};
