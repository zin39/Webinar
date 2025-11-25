const UAParser = require('ua-parser-js');
const prisma = require('../config/db');

// Paths to exclude from analytics
const excludedPaths = [
  '/api/',
  '/favicon.ico',
  '/css/',
  '/js/',
  '/images/',
  '/fonts/'
];

// Analytics middleware
const analyticsMiddleware = async (req, res, next) => {
  // Skip excluded paths
  if (excludedPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Skip non-GET requests for page views (we track them separately)
  if (req.method !== 'GET') {
    return next();
  }

  try {
    // Parse user agent
    const ua = new UAParser(req.get('user-agent'));
    const browser = ua.getBrowser();
    const os = ua.getOS();
    const device = ua.getDevice();

    // Get IP address
    const ip = req.ip || 
               req.headers['x-forwarded-for']?.split(',')[0] || 
               req.connection?.remoteAddress;

    // Store page view asynchronously (don't wait)
    prisma.pageView.create({
      data: {
        path: req.path,
        method: req.method,
        ip: ip?.substring(0, 45),
        userAgent: req.get('user-agent')?.substring(0, 500),
        browser: browser.name ? `${browser.name} ${browser.version || ''}`.trim() : null,
        os: os.name ? `${os.name} ${os.version || ''}`.trim() : null,
        device: device.type || 'desktop',
        referer: req.get('referer')?.substring(0, 500),
        sessionId: req.sessionID
      }
    }).catch(err => {
      console.error('Failed to log page view:', err.message);
    });
  } catch (err) {
    console.error('Analytics middleware error:', err.message);
  }

  next();
};

// Get analytics summary
const getAnalyticsSummary = async (days = 7) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    // Total page views
    const totalViews = await prisma.pageView.count({
      where: { timestamp: { gte: startDate } }
    });

    // Unique visitors (by session)
    const uniqueVisitors = await prisma.pageView.groupBy({
      by: ['sessionId'],
      where: { 
        timestamp: { gte: startDate },
        sessionId: { not: null }
      }
    });

    // Views by page
    const viewsByPage = await prisma.pageView.groupBy({
      by: ['path'],
      where: { timestamp: { gte: startDate } },
      _count: { path: true },
      orderBy: { _count: { path: 'desc' } },
      take: 10
    });

    // Views by day
    const viewsByDay = await prisma.$queryRaw`
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as views,
        COUNT(DISTINCT "sessionId") as visitors
      FROM "PageView"
      WHERE timestamp >= ${startDate}
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
      LIMIT 7
    `;

    // Browser stats
    const browserStats = await prisma.pageView.groupBy({
      by: ['browser'],
      where: { 
        timestamp: { gte: startDate },
        browser: { not: null }
      },
      _count: { browser: true },
      orderBy: { _count: { browser: 'desc' } },
      take: 5
    });

    // Device stats
    const deviceStats = await prisma.pageView.groupBy({
      by: ['device'],
      where: { timestamp: { gte: startDate } },
      _count: { device: true }
    });

    // Recent errors
    const recentErrors = await prisma.errorLog.findMany({
      where: { timestamp: { gte: startDate } },
      orderBy: { timestamp: 'desc' },
      take: 10
    });

    // Error count by level
    const errorCounts = await prisma.errorLog.groupBy({
      by: ['level'],
      where: { timestamp: { gte: startDate } },
      _count: { level: true }
    });

    return {
      totalViews,
      uniqueVisitors: uniqueVisitors.length,
      viewsByPage: viewsByPage.map(v => ({ path: v.path, count: v._count.path })),
      viewsByDay,
      browserStats: browserStats.map(b => ({ browser: b.browser, count: b._count.browser })),
      deviceStats: deviceStats.map(d => ({ device: d.device || 'desktop', count: d._count.device })),
      recentErrors,
      errorCounts: errorCounts.reduce((acc, e) => ({ ...acc, [e.level]: e._count.level }), {})
    };
  } catch (err) {
    console.error('Failed to get analytics:', err);
    return null;
  }
};

module.exports = { analyticsMiddleware, getAnalyticsSummary };
