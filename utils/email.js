const nodemailer = require('nodemailer');
const prisma = require('../config/db');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Helper function to log email attempts
const logEmailAttempt = async (data) => {
  try {
    await prisma.emailLog.create({
      data: {
        toEmail: data.toEmail,
        toName: data.toName || null,
        subject: data.subject,
        type: data.type,
        status: data.status,
        errorMessage: data.errorMessage || null,
        errorCode: data.errorCode || null,
        smtpResponse: data.smtpResponse || null,
        attendeeId: data.attendeeId || null,
        retryCount: data.retryCount || 0,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null
      }
    });
  } catch (err) {
    console.error('Failed to log email attempt:', err);
  }
};

const sendConfirmationEmail = async (attendee, webinar, calendarLinks) => {
  const subject = `⏰ Student Mental Health Webinar is TOMORROW - You're In!`;

  // Skip if SMTP not configured
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('SMTP not configured, skipping email');
    await logEmailAttempt({
      toEmail: attendee.email,
      toName: attendee.name,
      subject: subject,
      type: 'confirmation',
      status: 'skipped',
      errorMessage: 'SMTP not configured',
      attendeeId: attendee.id
    });
    return;
  }

  const transporter = createTransporter();

  const webinarDate = new Date(webinar.date);
  const formattedDate = webinarDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Calculate Nepal Time (UTC+5:45)
  const nepalOffset = 5 * 60 + 45; // minutes
  const nepalDate = new Date(webinarDate.getTime() + nepalOffset * 60 * 1000);
  const nepalHours = nepalDate.getUTCHours();
  const nepalMinutes = nepalDate.getUTCMinutes();
  const nepalAmPm = nepalHours >= 12 ? 'PM' : 'AM';
  const nepalHour12 = nepalHours % 12 || 12;
  const nepalTimeStr = nepalHour12 + ':' + (nepalMinutes < 10 ? '0' : '') + nepalMinutes + ' ' + nepalAmPm + ' NPT';

  const utcHours = webinarDate.getUTCHours();
  const utcMinutes = webinarDate.getUTCMinutes();
  const utcTimeStr = utcHours + ':' + (utcMinutes < 10 ? '0' : '') + utcMinutes + ' UTC';

  const formattedTime = nepalTimeStr + ' / ' + utcTimeStr;

  // Pre-webinar survey link - using token for secure access
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  const surveyLink = `${siteUrl}/survey/pre-webinar?token=${attendee.surveyToken}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background: #f1f5f9; }
        .wrapper { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%); color: white; padding: 40px 30px; text-align: center; }
        .countdown-badge { display: inline-block; background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); color: white; padding: 8px 20px; border-radius: 30px; font-size: 13px; font-weight: 600; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.3); letter-spacing: 1px; }
        .header h1 { margin: 0 0 10px 0; font-size: 28px; font-weight: 700; line-height: 1.2; }
        .header-subtitle { margin: 0; opacity: 0.95; font-size: 16px; font-weight: 400; }
        .content { padding: 35px 30px; }
        .greeting { font-size: 17px; margin-bottom: 20px; }
        .hero-message { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 16px; padding: 25px; margin: 25px 0; text-align: center; border: 2px solid #fbbf24; }
        .hero-message p { margin: 0; font-size: 15px; color: #92400e; }
        .hero-message strong { color: #78350f; }
        .event-card { background: #ffffff; border-radius: 16px; padding: 0; margin: 25px 0; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; overflow: hidden; }
        .event-header { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: white; padding: 20px 25px; }
        .event-title { font-size: 18px; font-weight: 700; margin: 0 0 5px 0; }
        .event-tagline { font-size: 13px; opacity: 0.85; margin: 0; }
        .event-details { padding: 25px; }
        .detail-item { display: flex; align-items: center; margin: 15px 0; font-size: 15px; }
        .detail-icon { width: 40px; height: 40px; background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 18px; }
        .detail-text strong { display: block; color: #1e293b; font-size: 15px; }
        .detail-text span { color: #64748b; font-size: 13px; }
        .zoom-section { background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-radius: 16px; padding: 25px; margin: 25px 0; border: 2px solid #3b82f6; }
        .zoom-header { display: flex; align-items: center; margin-bottom: 15px; }
        .zoom-icon { font-size: 24px; margin-right: 10px; }
        .zoom-title { color: #1e40af; font-size: 18px; font-weight: 700; margin: 0; }
        .zoom-btn { display: block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 16px 24px; border-radius: 12px; font-weight: 700; font-size: 16px; text-align: center; margin: 15px 0; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3); }
        .zoom-credentials { background: rgba(255,255,255,0.7); border-radius: 10px; padding: 15px; margin-top: 15px; }
        .zoom-credentials p { margin: 5px 0; font-size: 14px; color: #1e40af; }
        .zoom-tip { font-size: 13px; color: #1e40af; margin-top: 15px; font-style: italic; }
        .speakers-section { margin: 30px 0; }
        .section-title { color: #6366f1; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px; text-align: center; }
        .speakers-grid { display: table; width: 100%; }
        .speaker-row { display: table-row; }
        .speaker { display: table-cell; width: 50%; padding: 10px; vertical-align: top; }
        .speaker-card { background: #f8fafc; border-radius: 12px; padding: 15px; text-align: center; border: 1px solid #e2e8f0; }
        .speaker-avatar { width: 50px; height: 50px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 50%; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 18px; }
        .speaker-name { font-weight: 700; color: #1e293b; font-size: 14px; margin: 0 0 3px 0; }
        .speaker-role { color: #64748b; font-size: 11px; margin: 0; }
        .survey-section { background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 16px; padding: 30px; margin: 30px 0; text-align: center; border: 2px solid #10b981; }
        .survey-emoji { font-size: 40px; margin-bottom: 15px; }
        .survey-title { color: #065f46; font-size: 20px; font-weight: 700; margin: 0 0 10px 0; }
        .survey-subtitle { color: #047857; font-size: 15px; margin: 0 0 8px 0; }
        .survey-reward { background: #ffffff; border-radius: 8px; padding: 10px 15px; display: inline-block; margin: 15px 0; font-size: 13px; color: #065f46; border: 1px solid #a7f3d0; }
        .survey-btn { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3); margin-top: 10px; }
        .tips-section { background: #fffbeb; border-radius: 16px; padding: 25px; margin: 25px 0; border-left: 4px solid #f59e0b; }
        .tips-title { color: #92400e; font-size: 16px; font-weight: 700; margin: 0 0 15px 0; }
        .tips-list { margin: 0; padding-left: 0; list-style: none; }
        .tips-list li { padding: 8px 0; color: #78350f; font-size: 14px; padding-left: 25px; position: relative; }
        .tips-list li:before { content: "✓"; position: absolute; left: 0; color: #f59e0b; font-weight: bold; }
        .calendar-section { text-align: center; margin: 30px 0; padding: 20px; background: #f8fafc; border-radius: 12px; }
        .calendar-label { color: #64748b; font-size: 14px; margin-bottom: 15px; }
        .calendar-btn { display: inline-block; background: #64748b; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 5px; }
        .footer { background: #1e1b4b; color: white; padding: 30px; text-align: center; }
        .footer-cta { font-size: 22px; font-weight: 700; margin: 0 0 20px 0; }
        .footer-name { font-size: 16px; margin: 5px 0; }
        .footer-org { font-size: 14px; opacity: 0.8; margin: 5px 0; }
        .footer-contact { margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.2); }
        .footer-contact a { color: #a5b4fc; text-decoration: none; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="countdown-badge">⏰ HAPPENING TOMORROW!</div>
          <h1>Student Mental Health:<br>Thriving Beyond Grades</h1>
          <p class="header-subtitle">Your seat is confirmed for this FREE webinar</p>
        </div>

        <div class="content">
          <p class="greeting">Hi <strong>${attendee.name}</strong>! 👋</p>

          <p>Great news - you're registered for tomorrow's webinar on student mental health!</p>

          <div class="hero-message">
            <p><strong>Did you know?</strong> 1 in 4 students struggle with academic stress, but most don't know where to turn. Tomorrow, we change that. <strong>You're taking an important step!</strong></p>
          </div>

          <div class="event-card">
            <div class="event-header">
              <p class="event-title">📚 Student Mental Health Webinar</p>
              <p class="event-tagline">An honest conversation about academic stress & thriving</p>
            </div>
            <div class="event-details">
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
          </div>

          <div class="zoom-section">
            <div class="zoom-header">
              <span class="zoom-icon">🎥</span>
              <p class="zoom-title">Your Zoom Access</p>
            </div>
            <a href="https://us06web.zoom.us/j/84978475078?pwd=EZIf1n9Pjy7bcozayzob4m1H9nlZTF.1" class="zoom-btn">
              👉 Click Here to Join Tomorrow
            </a>
            <div class="zoom-credentials">
              <p><strong>Meeting ID:</strong> 849 7847 5078</p>
              <p><strong>Passcode:</strong> 090152</p>
            </div>
            <p class="zoom-tip">💡 Pro tip: Bookmark this link now so you don't miss the session!</p>
          </div>

          <div class="speakers-section">
            <p class="section-title">✨ Learn From Expert Speakers</p>
            <table class="speakers-grid" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="width: 50%; padding: 8px; vertical-align: top;">
                  <div class="speaker-card">
                    <div class="speaker-avatar">AP</div>
                    <p class="speaker-name">Dr. Aditi Pajiyar</p>
                    <p class="speaker-role">Mental Health Fellow, NHAFN<br>(Host)</p>
                  </div>
                </td>
                <td style="width: 50%; padding: 8px; vertical-align: top;">
                  <div class="speaker-card">
                    <div class="speaker-avatar">AJ</div>
                    <p class="speaker-name">Dr. Amit Jha</p>
                    <p class="speaker-role">Child & Adolescent<br>Psychiatrist</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="width: 50%; padding: 8px; vertical-align: top;">
                  <div class="speaker-card">
                    <div class="speaker-avatar">NP</div>
                    <p class="speaker-name">Nikita Pradhan</p>
                    <p class="speaker-role">Clinical<br>Psychologist</p>
                  </div>
                </td>
                <td style="width: 50%; padding: 8px; vertical-align: top;">
                  <div class="speaker-card">
                    <div class="speaker-avatar">GM</div>
                    <p class="speaker-name">Gopal Mahaseth</p>
                    <p class="speaker-role">Educator</p>
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <div class="survey-section">
            <div class="survey-emoji">📋</div>
            <p class="survey-title">Help Us Help You Better!</p>
            <p class="survey-subtitle">Take our 2-minute pre-webinar survey</p>
            <div class="survey-reward">🎯 Your responses help us address YOUR specific concerns during the session!</div>
            <br>
            <a href="${surveyLink}" class="survey-btn">Complete Quick Survey →</a>
          </div>

          <div class="tips-section">
            <p class="tips-title">📝 Get Ready for Tomorrow:</p>
            <ul class="tips-list">
              <li>Test your Zoom app & internet connection</li>
              <li>Find a quiet, comfortable space</li>
              <li>Have a notebook ready for insights</li>
              <li>Think of questions you'd like answered</li>
            </ul>
          </div>

          <div class="calendar-section">
            <p class="calendar-label">📆 Add to your calendar so you don't forget:</p>
            <a href="${calendarLinks.google}" class="calendar-btn" target="_blank">Google Calendar</a>
            <a href="${calendarLinks.outlook}" class="calendar-btn" target="_blank">Outlook</a>
          </div>
        </div>

        <div class="footer">
          <p class="footer-cta">See you tomorrow! 🌟</p>
          <p class="footer-name"><strong>Dr. Aditi Pajiyar</strong></p>
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

  const textContent = `
HAPPENING TOMORROW!

Dear ${attendee.name},

Thank you for registering! We're excited to have you join this important conversation about student mental health.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WEBINAR DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Student Mental Health: Thriving Beyond Grades
An honest conversation about academic stress

📅 Date: Sunday, November 30, 2025
⏰ Time: 6:00 PM NPT (Nepal Time)
⏱️ Duration: 60 minutes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎥 JOIN ZOOM MEETING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Click to join: https://us06web.zoom.us/j/84978475078?pwd=EZIf1n9Pjy7bcozayzob4m1H9nlZTF.1

Meeting ID: 849 7847 5078
Passcode: 090152

💡 Bookmark this link now so you don't miss it!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FEATURED SPEAKERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Dr. Aditi Pajiyar - Mental Health Fellow, NHAFN (Host)
• Dr. Amit Jha - Child & Adolescent Psychiatrist
• Nikita Pradhan - Clinical Psychologist
• Gopal Mahaseth - Educator

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 QUICK PRE-WEBINAR SURVEY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Help us personalize the session for you! Takes only 2 minutes.
Complete survey: ${surveyLink}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 BEFORE THE WEBINAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Test your Zoom app and internet connection
• Find a quiet, comfortable space
• Prepare any questions you'd like to ask
• Keep a notebook handy for notes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add to Google Calendar: ${calendarLinks.google}

Questions? Contact us at mentalwellbeing1008@gmail.com

See you tomorrow!

Warm regards,
Dr. Aditi Pajiyar
NHAFN Mental Health Fellow
National Health Action Force Nepal
  `;

  try {
    const result = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: attendee.email,
      subject: subject,
      text: textContent,
      html: htmlContent
    });

    // Update attendee record
    await prisma.attendee.update({
      where: { id: attendee.id },
      data: { emailSent: true }
    });

    // Log successful email
    await logEmailAttempt({
      toEmail: attendee.email,
      toName: attendee.name,
      subject: subject,
      type: 'confirmation',
      status: 'sent',
      smtpResponse: result.response || null,
      attendeeId: attendee.id,
      metadata: { messageId: result.messageId }
    });

    console.log(`Confirmation email sent to ${attendee.email}`);
  } catch (error) {
    console.error('Email send error:', error);

    // Log failed email
    await logEmailAttempt({
      toEmail: attendee.email,
      toName: attendee.name,
      subject: subject,
      type: 'confirmation',
      status: 'failed',
      errorMessage: error.message || 'Unknown error',
      errorCode: error.code || null,
      smtpResponse: error.response || null,
      attendeeId: attendee.id,
      metadata: { stack: error.stack }
    });

    throw error;
  }
};

module.exports = { sendConfirmationEmail };
