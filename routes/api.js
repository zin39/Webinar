const express = require('express');
const router = express.Router();
const prisma = require('../config/db');

// Get attendee count (for live updates on landing page)
router.get('/attendee-count', async (req, res) => {
  try {
    const count = await prisma.attendee.count();
    res.json({ count });
  } catch (error) {
    res.json({ count: 0 });
  }
});

// Get webinar config (for countdown timer)
router.get('/webinar-config', async (req, res) => {
  try {
    const config = await prisma.webinarConfig.findFirst({
      where: { isActive: true },
      select: {
        title: true,
        date: true,
        duration: true
      }
    });

    if (config) {
      return res.json(config);
    }

    res.json({
      title: 'Webinar',
      date: process.env.WEBINAR_DATE || '2025-12-01T14:00:00Z',
      duration: 60
    });
  } catch (error) {
    res.json({
      date: process.env.WEBINAR_DATE || '2025-12-01T14:00:00Z',
      duration: 60
    });
  }
});

module.exports = router;
