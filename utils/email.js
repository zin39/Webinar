/**
 * Email utility for sending webinar emails
 * Uses Brevo API for transactional emails
 */

const { sendEmail, logEmailAttempt } = require('./brevoEmail');
const prisma = require('../config/db');

// Email type configurations
const EMAIL_TYPES = {
  confirmation: {
    type: 'confirmation',
    defaultSubject: `⏰ Student Mental Health Webinar is TOMORROW - You're In!`,
    badge: 'HAPPENING TOMORROW!',
    greeting: "Great news - you're registered for tomorrow's webinar on student mental health!"
  },
  subscription: {
    type: 'subscription',
    defaultSubject: `Welcome to Mental Health Awareness Initiative!`,
    badge: 'SUBSCRIPTION CONFIRMED',
    greeting: "Thank you for subscribing to our Mental Health Awareness Initiative! We're excited to have you join our community focused on student mental health and wellbeing."
  },
  reminder1: {
    type: 'reminder',
    defaultSubject: '📅 Reminder: Student Mental Health Webinar Tomorrow!',
    badge: 'HAPPENING TOMORROW!',
    greeting: "Just a friendly reminder - the Student Mental Health webinar is happening tomorrow!"
  },
  reminder2: {
    type: 'reminder',
    defaultSubject: '⏰ Starting in a Few Hours: Student Mental Health Webinar',
    badge: 'STARTING SOON!',
    greeting: "Get ready! The Student Mental Health webinar starts in just a few hours!"
  },
  reminder3: {
    type: 'reminder',
    defaultSubject: '🚀 Starting NOW: Join the Student Mental Health Webinar!',
    badge: 'STARTING NOW!',
    greeting: "The moment is here! The Student Mental Health webinar is about to begin!"
  },
  postWebinar: {
    type: 'postWebinar',
    defaultSubject: 'Thank You - Student Mental Health Webinar Resources',
    badge: '',
    greeting: 'Thank you for being part of our Student Mental Health: Thriving Beyond Grades webinar. We hope the discussion with Dr. Amit Jha, Nikita Pradhan, and Gopal Mahaseth provided valuable insights for you.'
  }
};

/**
 * Generate HTML email content
 */
const generateHtmlContent = (attendee, surveyLink, calendarLinks, emailType, customSubject) => {
  const config = EMAIL_TYPES[emailType] || EMAIL_TYPES.confirmation;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background: #f1f5f9; }
        .wrapper { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%); color: white; padding: 40px 30px; text-align: center; }
        .countdown-badge { display: inline-block; background: rgba(255,255,255,0.2); color: white; padding: 8px 20px; border-radius: 30px; font-size: 13px; font-weight: 600; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.3); letter-spacing: 1px; }
        .header h1 { margin: 0 0 10px 0; font-size: 28px; font-weight: 700; line-height: 1.2; }
        .header-subtitle { margin: 0; opacity: 0.95; font-size: 16px; font-weight: 400; }
        .content { padding: 35px 30px; background: #ffffff; }
        .greeting { font-size: 17px; margin-bottom: 15px; color: #1e293b; }
        .intro-text { color: #374151; font-size: 15px; margin-bottom: 25px; }
        .event-card { background: #f8fafc; border-radius: 16px; padding: 25px; margin: 25px 0; border: 1px solid #e2e8f0; }
        .event-title { font-size: 18px; font-weight: 700; margin: 0 0 20px 0; color: #1e293b; }
        .detail-item { display: flex; align-items: center; margin: 12px 0; font-size: 15px; }
        .detail-icon { width: 35px; height: 35px; background: #ede9fe; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 16px; }
        .detail-text strong { display: block; color: #1e293b; font-size: 15px; }
        .detail-text span { color: #6b7280; font-size: 13px; }
        .zoom-section { background: #eff6ff; border-radius: 16px; padding: 25px; margin: 25px 0; border: 1px solid #bfdbfe; }
        .zoom-title { color: #1e40af; font-size: 18px; font-weight: 700; margin: 0 0 15px 0; }
        .zoom-btn { display: block; background: #2563eb; color: white; text-decoration: none; padding: 16px 24px; border-radius: 10px; font-weight: 700; font-size: 16px; text-align: center; margin: 15px 0; }
        .zoom-credentials { background: #ffffff; border-radius: 10px; padding: 15px; margin-top: 15px; }
        .zoom-credentials p { margin: 5px 0; font-size: 14px; color: #374151; }
        .zoom-tip { font-size: 13px; color: #6b7280; margin-top: 15px; font-style: italic; }
        .survey-section { background: #f0fdf4; border-radius: 16px; padding: 25px; margin: 25px 0; text-align: center; border: 1px solid #bbf7d0; }
        .survey-title { color: #166534; font-size: 18px; font-weight: 700; margin: 0 0 8px 0; }
        .survey-subtitle { color: #15803d; font-size: 14px; margin: 0 0 5px 0; }
        .survey-note { color: #166534; font-size: 13px; margin: 10px 0 15px 0; }
        .survey-btn { display: inline-block; background: #16a34a; color: white; text-decoration: none; padding: 14px 35px; border-radius: 10px; font-weight: 700; font-size: 15px; }
        .speakers-section { margin: 30px 0; padding: 25px; background: #f8fafc; border-radius: 16px; }
        .section-title { color: #6366f1; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 15px 0; }
        .speaker-list { margin: 0; padding: 0; list-style: none; }
        .speaker-list li { padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #374151; font-size: 14px; }
        .speaker-list li:last-child { border-bottom: none; }
        .speaker-list strong { color: #1e293b; }
        .tips-section { background: #fffbeb; border-radius: 16px; padding: 20px 25px; margin: 25px 0; border-left: 4px solid #f59e0b; }
        .tips-title { color: #92400e; font-size: 15px; font-weight: 700; margin: 0 0 12px 0; }
        .tips-list { margin: 0; padding-left: 20px; color: #92400e; }
        .tips-list li { padding: 4px 0; font-size: 14px; }
        .calendar-section { text-align: center; margin: 25px 0; padding: 20px; background: #f8fafc; border-radius: 12px; }
        .calendar-label { color: #6b7280; font-size: 14px; margin: 0 0 15px 0; }
        .calendar-btn { display: inline-block; background: #6b7280; color: white; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 13px; margin: 5px; }
        .divider { height: 1px; background: #e5e7eb; margin: 25px 0; }
        .footer { background: #1e1b4b; color: white; padding: 30px; text-align: center; }
        .footer-cta { font-size: 20px; font-weight: 700; margin: 0 0 15px 0; }
        .footer-name { font-size: 16px; margin: 5px 0; font-weight: 600; }
        .footer-org { font-size: 14px; opacity: 0.8; margin: 3px 0; }
        .footer-contact { margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.2); }
        .footer-contact a { color: #a5b4fc; text-decoration: none; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="countdown-badge">${config.badge}</div>
          <h1>Student Mental Health:<br>Thriving Beyond Grades</h1>
          <p class="header-subtitle">Your seat is confirmed for this FREE webinar</p>
        </div>

        <div class="content">
          <p class="greeting">Hi <strong>${attendee.name}</strong>,</p>

          <p class="intro-text">${config.greeting}</p>

          <div class="event-card">
            <p class="event-title">Webinar Details</p>
            <div class="detail-item">
              <div class="detail-icon">📅</div>
              <div class="detail-text">
                <strong>Sunday, November 30, 2025</strong>
                <span>Mark your calendar!</span>
              </div>
            </div>
            <div class="detail-item">
              <div class="detail-icon">⏰</div>
              <div class="detail-text">
                <strong>6:00 PM NPT</strong>
                <span>Nepal Time (60 minutes)</span>
              </div>
            </div>
            <div class="detail-item">
              <div class="detail-icon">💻</div>
              <div class="detail-text">
                <strong>Live on Zoom</strong>
                <span>Interactive session with Q&A</span>
              </div>
            </div>
          </div>

          <div class="zoom-section">
            <p class="zoom-title">🎥 Your Zoom Access</p>
            <a href="https://us06web.zoom.us/j/84978475078?pwd=EZIf1n9Pjy7bcozayzob4m1H9nlZTF.1" class="zoom-btn">Click Here to Join</a>
            <div class="zoom-credentials">
              <p><strong>Meeting ID:</strong> 849 7847 5078</p>
              <p><strong>Passcode:</strong> 090152</p>
            </div>
            <p class="zoom-tip">💡 Bookmark this link now so you don't miss the session!</p>
          </div>

          <div class="survey-section">
            <p class="survey-title">📋 Help Us Help You Better!</p>
            <p class="survey-subtitle">Take our 2-minute pre-webinar survey</p>
            <p class="survey-note">Your responses help us address YOUR specific concerns during the session!</p>
            <a href="${surveyLink}" class="survey-btn">Complete Quick Survey →</a>
          </div>

          <div class="speakers-section">
            <p class="section-title">Featured Speakers</p>
            <ul class="speaker-list">
              <li><strong>Dr. Aditi Pajiyar</strong> - Mental Health Fellow, NHAFN (Host)</li>
              <li><strong>Dr. Amit Jha</strong> - Child & Adolescent Psychiatrist</li>
              <li><strong>Nikita Pradhan</strong> - Clinical Psychologist</li>
              <li><strong>Gopal Mahaseth</strong> - Educator</li>
            </ul>
          </div>

          <div class="tips-section">
            <p class="tips-title">📝 Get Ready:</p>
            <ul class="tips-list">
              <li>Test your Zoom app & internet connection</li>
              <li>Find a quiet, comfortable space</li>
              <li>Have a notebook ready for insights</li>
              <li>Think of questions you'd like answered</li>
            </ul>
          </div>

          ${calendarLinks ? `
          <div class="calendar-section">
            <p class="calendar-label">📆 Add to your calendar:</p>
            <a href="${calendarLinks.google}" class="calendar-btn" target="_blank">Google Calendar</a>
            <a href="${calendarLinks.outlook}" class="calendar-btn" target="_blank">Outlook</a>
          </div>
          ` : ''}

          <div class="divider"></div>

          <p style="text-align: center; color: #6b7280; font-size: 14px;">Questions? Contact us at <a href="mailto:mentalwellbeing1008@gmail.com" style="color: #6366f1;">mentalwellbeing1008@gmail.com</a></p>
        </div>

        <div class="footer">
          <p class="footer-cta">See you soon! 🌟</p>
          <p class="footer-name">Dr. Aditi Pajiyar</p>
          <p class="footer-org">NHAFN Mental Health Fellow</p>
          <p class="footer-org">National Health Action Force Nepal</p>
          <div class="footer-contact">
            <a href="mailto:mentalwellbeing1008@gmail.com">📧 mentalwellbeing1008@gmail.com</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate plain text email content
 */
const generateTextContent = (attendee, surveyLink, calendarLinks, emailType) => {
  const config = EMAIL_TYPES[emailType] || EMAIL_TYPES.confirmation;

  return `
${config.badge}

Hi ${attendee.name},

${config.greeting}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WEBINAR DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Date: Sunday, November 30, 2025
⏰ Time: 6:00 PM NPT (Nepal Time)
⏱️ Duration: 60 minutes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎥 YOUR ZOOM ACCESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Click to join: https://us06web.zoom.us/j/84978475078?pwd=EZIf1n9Pjy7bcozayzob4m1H9nlZTF.1

Meeting ID: 849 7847 5078
Passcode: 090152

💡 Bookmark this link now so you don't miss it!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 QUICK PRE-WEBINAR SURVEY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Help us personalize the session for you! Takes only 2 minutes.
Complete survey: ${surveyLink}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FEATURED SPEAKERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Dr. Aditi Pajiyar - Mental Health Fellow, NHAFN (Host)
• Dr. Amit Jha - Child & Adolescent Psychiatrist
• Nikita Pradhan - Clinical Psychologist
• Gopal Mahaseth - Educator

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 GET READY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Test your Zoom app & internet connection
• Find a quiet, comfortable space
• Have a notebook ready for insights
• Think of questions you'd like answered

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${calendarLinks ? `Add to Google Calendar: ${calendarLinks.google}` : ''}

Questions? Contact us at mentalwellbeing1008@gmail.com

See you soon! 🌟

Dr. Aditi Pajiyar
NHAFN Mental Health Fellow
National Health Action Force Nepal
  `;
};

/**
 * Send confirmation email (original registration email)
 */
const sendConfirmationEmail = async (attendee, webinar, calendarLinks) => {
  return sendWebinarEmail(attendee, calendarLinks, 'confirmation');
};

/**
 * Send webinar email with customizable type
 * @param {Object} attendee - Attendee object with name, email, surveyToken
 * @param {Object} calendarLinks - Optional calendar links
 * @param {string} emailType - Type of email: confirmation, reminder1, reminder2, reminder3
 * @param {string} customSubject - Optional custom subject line
 */
const sendWebinarEmail = async (attendee, calendarLinks, emailType = 'confirmation', customSubject = null) => {
  const config = EMAIL_TYPES[emailType] || EMAIL_TYPES.confirmation;
  const subject = customSubject || config.defaultSubject;

  // Generate survey link
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  const surveyLink = `${siteUrl}/survey/pre-webinar?token=${attendee.surveyToken}`;

  // Generate email content
  const htmlContent = generateHtmlContent(attendee, surveyLink, calendarLinks, emailType, customSubject);
  const textContent = generateTextContent(attendee, surveyLink, calendarLinks, emailType);

  // Send via Brevo API
  const result = await sendEmail({
    to: attendee.email,
    toName: attendee.name,
    subject: subject,
    htmlContent: htmlContent,
    textContent: textContent,
    type: config.type,
    attendeeId: attendee.id
  });

  // Update attendee record if successful
  if (result.success) {
    const updateData = { emailSent: true };

    // Also update reminder flags based on type
    if (emailType === 'reminder1') updateData.reminder1Sent = true;
    if (emailType === 'reminder2') updateData.reminder2Sent = true;
    if (emailType === 'reminder3') updateData.reminder3Sent = true;

    await prisma.attendee.update({
      where: { id: attendee.id },
      data: updateData
    });
  }

  return result;
};

/**
 * Send reminder email to an attendee
 * @param {Object} attendee - Attendee object
 * @param {number} reminderSlot - Reminder slot number (1, 2, or 3)
 * @param {string} customSubject - Optional custom subject
 */
const sendReminderEmail = async (attendee, reminderSlot, customSubject = null) => {
  const emailType = `reminder${reminderSlot}`;
  return sendWebinarEmail(attendee, null, emailType, customSubject);
};

/**
 * Generate HTML content for post-webinar survey email
 * Simple, personal design to avoid Promotions folder
 */
const generatePostWebinarHtmlContent = (attendee, postSurveyLink, preSurveyLink, pptLink) => {
  const config = EMAIL_TYPES.postWebinar;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.7; color: #333333; margin: 0; padding: 0; background: #ffffff; }
        .wrapper { max-width: 600px; margin: 0 auto; padding: 20px; }
        .content { padding: 20px 0; }
        p { margin: 0 0 16px 0; font-size: 15px; }
        .greeting { margin-bottom: 20px; }
        .section { margin: 24px 0; padding: 20px; background: #f9fafb; border-radius: 8px; }
        .section-primary { margin: 24px 0; padding: 20px; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe; }
        .section-title { font-size: 15px; font-weight: 600; color: #1f2937; margin: 0 0 12px 0; }
        .link { color: #2563eb; text-decoration: none; }
        .link:hover { text-decoration: underline; }
        .download-btn { display: inline-block; background: #2563eb; color: #ffffff !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 8px; }
        ul { margin: 12px 0; padding-left: 20px; }
        li { margin: 8px 0; font-size: 15px; }
        .youtube-note { background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 20px 0; font-size: 14px; color: #166534; border: 1px solid #bbf7d0; }
        .certificate-note { background: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0; font-size: 14px; color: #92400e; border: 1px solid #fcd34d; }
        .survey-section { margin: 20px 0; padding: 16px; background: #f9fafb; border-radius: 8px; }
        .survey-section p { font-size: 14px; color: #6b7280; margin-bottom: 12px; }
        .signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
        .signature p { margin: 4px 0; font-size: 14px; color: #6b7280; }
        .signature .name { color: #1f2937; font-weight: 600; font-size: 15px; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="content">
          <p class="greeting">Hi ${attendee.name},</p>

          <p>${config.greeting}</p>

          <div class="section-primary">
            <p class="section-title">Webinar Presentation</p>
            <p style="margin-bottom: 8px;">Here is the presentation from today's session. Feel free to download and share with others who might benefit:</p>
            <a href="${pptLink}" class="download-btn">Download Presentation</a>
          </div>

          <div class="youtube-note">
            <strong>Missed the live session?</strong> Don't worry! The full webinar recording will be published on our YouTube channel soon. Keep an eye out!
          </div>

          <div class="certificate-note">
            <strong>Certificate of Participation:</strong> To receive your certificate, please ensure you've completed both the pre-webinar and post-webinar surveys.
          </div>

          <div class="survey-section">
            <p>If you haven't already, please take a few minutes to complete our surveys:</p>
            <ul style="margin: 0;">
              <li><a href="${preSurveyLink}" class="link">Pre-webinar survey</a></li>
              <li><a href="${postSurveyLink}" class="link">Post-webinar feedback survey</a></li>
            </ul>
          </div>

          <p>Thank you for supporting student mental health awareness. Your participation means a lot to us!</p>

          <p>If you have any questions, feel free to reach out at <a href="mailto:mentalwellbeing1008@gmail.com" class="link">mentalwellbeing1008@gmail.com</a></p>

          <div class="signature">
            <p class="name">Dr. Aditi Pajiyar</p>
            <p>NHAFN Mental Health Fellow</p>
            <p>National Health Action Force Nepal</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate plain text content for post-webinar survey email
 * Simple, personal format to match HTML version
 */
const generatePostWebinarTextContent = (attendee, postSurveyLink, preSurveyLink, pptLink) => {
  const config = EMAIL_TYPES.postWebinar;

  return `Hi ${attendee.name},

${config.greeting}


WEBINAR PRESENTATION
--------------------
Here is the presentation from today's session. Feel free to download and share with others who might benefit:
${pptLink}


MISSED THE LIVE SESSION?
------------------------
Don't worry! The full webinar recording will be published on our YouTube channel soon. Keep an eye out!


CERTIFICATE OF PARTICIPATION
----------------------------
To receive your certificate, please ensure you've completed both the pre-webinar and post-webinar surveys.


SURVEY LINKS
------------
If you haven't already, please take a few minutes to complete our surveys:
- Pre-webinar survey: ${preSurveyLink}
- Post-webinar feedback survey: ${postSurveyLink}


Thank you for supporting student mental health awareness. Your participation means a lot to us!

If you have any questions, feel free to reach out at mentalwellbeing1008@gmail.com


Warm regards,

Dr. Aditi Pajiyar
NHAFN Mental Health Fellow
National Health Action Force Nepal
  `;
};

/**
 * Send post-webinar survey email to an attendee
 * @param {Object} attendee - Attendee object with name, email, surveyToken
 * @param {string} customSubject - Optional custom subject line
 */
const sendPostWebinarEmail = async (attendee, customSubject = null) => {
  const config = EMAIL_TYPES.postWebinar;
  const subject = customSubject || config.defaultSubject;

  // Generate survey links
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  const postSurveyLink = `${siteUrl}/survey/post-webinar?token=${attendee.surveyToken}`;
  const preSurveyLink = `${siteUrl}/survey/pre-webinar?token=${attendee.surveyToken}`;

  // PPT link - webinar presentation file
  const pptLink = process.env.POST_WEBINAR_PPT_URL || `${siteUrl}/Webinar_ppt.pptx`;

  // Generate email content with both survey links and PPT link
  const htmlContent = generatePostWebinarHtmlContent(attendee, postSurveyLink, preSurveyLink, pptLink);
  const textContent = generatePostWebinarTextContent(attendee, postSurveyLink, preSurveyLink, pptLink);

  // Send via Brevo API
  const result = await sendEmail({
    to: attendee.email,
    toName: attendee.name,
    subject: subject,
    htmlContent: htmlContent,
    textContent: textContent,
    type: config.type,
    attendeeId: attendee.id
  });

  // Update attendee record if successful
  if (result.success) {
    await prisma.attendee.update({
      where: { id: attendee.id },
      data: { postWebinarSent: true }
    });
  }

  return result;
};

/**
 * Generate HTML content for subscription confirmation email
 * Simple, personal design for future event subscribers
 */
const generateSubscriptionHtmlContent = (attendee) => {
  const config = EMAIL_TYPES.subscription;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.7; color: #333333; margin: 0; padding: 0; background: #ffffff; }
        .wrapper { max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%); color: white; padding: 40px 30px; text-align: center; }
        .badge { display: inline-block; background: rgba(255,255,255,0.2); color: white; padding: 8px 20px; border-radius: 30px; font-size: 12px; font-weight: 600; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.3); letter-spacing: 1px; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .content { padding: 30px; }
        p { margin: 0 0 16px 0; font-size: 15px; }
        .greeting { font-size: 16px; margin-bottom: 20px; }
        .highlight-box { background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 25px 0; border-left: 4px solid #22c55e; }
        .highlight-title { font-size: 15px; font-weight: 600; color: #166534; margin: 0 0 10px 0; }
        .highlight-list { margin: 10px 0; padding-left: 20px; }
        .highlight-list li { margin: 8px 0; font-size: 14px; color: #166534; }
        .info-box { background: #f8fafc; border-radius: 12px; padding: 20px; margin: 25px 0; }
        .info-title { font-size: 15px; font-weight: 600; color: #1f2937; margin: 0 0 10px 0; }
        .info-text { font-size: 14px; color: #6b7280; margin: 0; }
        .signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
        .signature p { margin: 4px 0; font-size: 14px; color: #6b7280; }
        .signature .name { color: #1f2937; font-weight: 600; font-size: 15px; }
        .footer { background: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb; }
        .footer p { font-size: 13px; color: #6b7280; margin: 5px 0; }
        .footer a { color: #6366f1; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="badge">${config.badge}</div>
          <h1>Mental Health Awareness Initiative</h1>
        </div>

        <div class="content">
          <p class="greeting">Hi <strong>${attendee.name}</strong>,</p>

          <p>${config.greeting}</p>

          <div class="highlight-box">
            <p class="highlight-title">What you'll receive:</p>
            <ul class="highlight-list">
              <li>Notifications about upcoming webinars and workshops</li>
              <li>Mental health resources and tips</li>
              <li>Expert insights on student wellbeing</li>
              <li>Early access to register for future events</li>
            </ul>
          </div>

          <div class="info-box">
            <p class="info-title">Our Recent Webinar</p>
            <p class="info-text">We recently hosted "Student Mental Health: Thriving Beyond Grades" featuring Dr. Amit Jha (Child & Adolescent Psychiatrist), Nikita Pradhan (Clinical Psychologist), and Gopal Mahaseth (Educator). Stay tuned for upcoming events!</p>
          </div>

          <p>We're committed to supporting student mental health awareness and creating meaningful conversations around wellbeing. Your interest in joining our community means a lot to us.</p>

          <p>If you have any questions or suggestions for future topics, feel free to reach out at <a href="mailto:mentalwellbeing1008@gmail.com" style="color: #6366f1; text-decoration: none;">mentalwellbeing1008@gmail.com</a></p>

          <div class="signature">
            <p class="name">Dr. Aditi Pajiyar</p>
            <p>NHAFN Mental Health Fellow</p>
            <p>National Health Action Force Nepal</p>
          </div>
        </div>

        <div class="footer">
          <p>Thank you for supporting mental health awareness!</p>
          <p><a href="mailto:mentalwellbeing1008@gmail.com">mentalwellbeing1008@gmail.com</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate plain text content for subscription confirmation email
 */
const generateSubscriptionTextContent = (attendee) => {
  const config = EMAIL_TYPES.subscription;

  return `Hi ${attendee.name},

${config.greeting}

WHAT YOU'LL RECEIVE
-------------------
- Notifications about upcoming webinars and workshops
- Mental health resources and tips
- Expert insights on student wellbeing
- Early access to register for future events


OUR RECENT WEBINAR
------------------
We recently hosted "Student Mental Health: Thriving Beyond Grades" featuring Dr. Amit Jha (Child & Adolescent Psychiatrist), Nikita Pradhan (Clinical Psychologist), and Gopal Mahaseth (Educator). Stay tuned for upcoming events!


We're committed to supporting student mental health awareness and creating meaningful conversations around wellbeing. Your interest in joining our community means a lot to us.

If you have any questions or suggestions for future topics, feel free to reach out at mentalwellbeing1008@gmail.com


Warm regards,

Dr. Aditi Pajiyar
NHAFN Mental Health Fellow
National Health Action Force Nepal
  `;
};

/**
 * Send subscription confirmation email to new subscribers
 * @param {Object} attendee - Attendee object with name, email
 */
const sendSubscriptionEmail = async (attendee) => {
  const config = EMAIL_TYPES.subscription;
  const subject = config.defaultSubject;

  // Generate email content
  const htmlContent = generateSubscriptionHtmlContent(attendee);
  const textContent = generateSubscriptionTextContent(attendee);

  // Send via Brevo API
  const result = await sendEmail({
    to: attendee.email,
    toName: attendee.name,
    subject: subject,
    htmlContent: htmlContent,
    textContent: textContent,
    type: config.type,
    attendeeId: attendee.id
  });

  // Update attendee record if successful
  if (result.success) {
    await prisma.attendee.update({
      where: { id: attendee.id },
      data: { emailSent: true }
    });
  }

  return result;
};

module.exports = {
  sendConfirmationEmail,
  sendWebinarEmail,
  sendReminderEmail,
  sendPostWebinarEmail,
  sendSubscriptionEmail,
  EMAIL_TYPES
};
