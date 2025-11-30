/**
 * Report Generator Utility
 * Generates comprehensive PDF reports for the webinar admin
 */

const puppeteer = require('puppeteer');
const prisma = require('../config/db');
const { getAnalyticsSummary } = require('../middleware/analytics');
const path = require('path');
const ejs = require('ejs');

/**
 * Count occurrences of each value in a field
 */
function countByField(responses, field) {
  const counts = {};
  responses.forEach(r => {
    const value = r[field];
    if (value !== null && value !== undefined) {
      counts[value] = (counts[value] || 0) + 1;
    }
  });
  return counts;
}

/**
 * Calculate average for numeric fields
 */
function calculateAverage(responses, field) {
  const values = responses.filter(r => r[field] != null).map(r => r[field]);
  if (values.length === 0) return 0;
  return (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(1);
}

/**
 * Convert counts object to sorted array for charts
 */
function countsToArray(counts, order = null) {
  const arr = Object.entries(counts).map(([label, value]) => ({ label, value }));
  if (order) {
    return arr.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  }
  return arr.sort((a, b) => b.value - a.value);
}

/**
 * Gather all data needed for the report
 */
async function gatherReportData() {
  // Get all attendees
  const attendees = await prisma.attendee.findMany({
    orderBy: { registeredAt: 'desc' }
  });

  // Get survey responses
  const preSurveys = await prisma.surveyResponse.findMany({
    where: { surveyType: 'pre-webinar' }
  });

  const postSurveys = await prisma.surveyResponse.findMany({
    where: { surveyType: 'post-webinar' }
  });

  // Get analytics (all time)
  const allTimeAnalytics = await getAnalyticsSummary(365); // Full year
  const recentAnalytics = await getAnalyticsSummary(30); // Last 30 days

  // Calculate summary stats
  const summary = {
    totalRegistrations: attendees.length,
    emailsSent: attendees.filter(a => a.emailSent).length,
    preSurveyCount: preSurveys.length,
    postSurveyCount: postSurveys.length,
    preSurveyRate: attendees.length > 0 ? ((preSurveys.length / attendees.length) * 100).toFixed(1) : 0,
    postSurveyRate: attendees.length > 0 ? ((postSurveys.length / attendees.length) * 100).toFixed(1) : 0,
    generatedAt: new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Kathmandu',
      dateStyle: 'full',
      timeStyle: 'short'
    })
  };

  // Pre-survey analytics
  const knowledgeLevelOrder = ['Very Low', 'Low', 'Moderate', 'High', 'Very High'];
  const academicStressOrder = ['No', 'Yes, personally', 'Yes, someone I know', 'Both', 'Prefer not to say'];
  const resourcesOrder = ['No', 'Not sure', 'Yes, I know one or two', 'Yes, I know several resources'];

  const preSurveyAnalytics = {
    knowledgeLevel: countsToArray(countByField(preSurveys, 'knowledgeLevel'), knowledgeLevelOrder),
    academicStress: countsToArray(countByField(preSurveys, 'academicStress'), academicStressOrder),
    comfortLevel: countByField(preSurveys, 'comfortLevel'),
    comfortLevelAvg: calculateAverage(preSurveys, 'comfortLevel'),
    knowsResources: countsToArray(countByField(preSurveys, 'knowsResources'), resourcesOrder)
  };

  // Post-survey analytics
  const satisfactionOrder = ['Very Dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very Satisfied'];
  const recommendOrder = ['Definitely Not', 'Probably Not', 'Maybe', 'Probably Yes', 'Definitely Yes'];
  const agreementOrder = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];

  const postSurveyAnalytics = {
    satisfaction: countsToArray(countByField(postSurveys, 'satisfaction'), satisfactionOrder),
    knowledgeLevelAfter: countsToArray(countByField(postSurveys, 'knowledgeLevelAfter'), knowledgeLevelOrder),
    contentRelevance: countByField(postSurveys, 'contentRelevance'),
    contentRelevanceAvg: calculateAverage(postSurveys, 'contentRelevance'),
    facilitatorRating: countByField(postSurveys, 'facilitatorRating'),
    facilitatorRatingAvg: calculateAverage(postSurveys, 'facilitatorRating'),
    learnedStrategies: countsToArray(countByField(postSurveys, 'learnedStrategies'), agreementOrder),
    comfortLevelAfter: countsToArray(countByField(postSurveys, 'comfortLevelAfter'), agreementOrder),
    knowsResourcesAfter: countsToArray(countByField(postSurveys, 'knowsResourcesAfter'), agreementOrder),
    wouldRecommend: countsToArray(countByField(postSurveys, 'wouldRecommend'), recommendOrder)
  };

  // Before vs After comparison
  const comparison = {
    knowledgeBefore: preSurveyAnalytics.knowledgeLevel,
    knowledgeAfter: postSurveyAnalytics.knowledgeLevelAfter,
    comfortBefore: preSurveyAnalytics.comfortLevelAvg,
    comfortAfter: calculateAverageFromAgreement(postSurveys, 'comfortLevelAfter')
  };

  // Traffic & conversion
  const traffic = {
    totalPageViews: allTimeAnalytics?.totalViews || 0,
    uniqueVisitors: allTimeAnalytics?.uniqueVisitors || 0,
    conversionRate: allTimeAnalytics?.uniqueVisitors > 0
      ? ((attendees.length / allTimeAnalytics.uniqueVisitors) * 100).toFixed(1)
      : 0,
    topPages: allTimeAnalytics?.viewsByPage?.slice(0, 5) || [],
    deviceStats: allTimeAnalytics?.deviceStats || [],
    browserStats: allTimeAnalytics?.browserStats?.slice(0, 5) || []
  };

  return {
    summary,
    traffic,
    preSurvey: preSurveyAnalytics,
    postSurvey: postSurveyAnalytics,
    comparison
  };
}

/**
 * Calculate average from agreement scale responses
 */
function calculateAverageFromAgreement(responses, field) {
  const scaleMap = {
    'Strongly Disagree': 1,
    'Disagree': 2,
    'Neutral': 3,
    'Agree': 4,
    'Strongly Agree': 5
  };

  const values = responses
    .filter(r => r[field] && scaleMap[r[field]])
    .map(r => scaleMap[r[field]]);

  if (values.length === 0) return '0.0';
  return (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(1);
}

/**
 * Generate PDF from HTML content
 */
async function generatePDF(htmlContent) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        bottom: '15mm',
        left: '12mm',
        right: '12mm'
      }
    });

    return pdf;
  } finally {
    await browser.close();
  }
}

/**
 * Render the report template with data
 */
async function renderReportTemplate(data) {
  const templatePath = path.join(__dirname, '../views/admin/report-template.ejs');
  return ejs.renderFile(templatePath, data);
}

/**
 * Generate complete report
 */
async function generateReport() {
  const data = await gatherReportData();
  const html = await renderReportTemplate(data);
  const pdf = await generatePDF(html);
  return pdf;
}

module.exports = {
  gatherReportData,
  generatePDF,
  renderReportTemplate,
  generateReport
};
