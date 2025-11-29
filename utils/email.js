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
  const subject = `You're registered: ${webinar.title}`;

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
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%); color: white; padding: 35px 30px; text-align: center; }
        .header h1 { margin: 0 0 8px 0; font-size: 26px; }
        .header p { margin: 0; opacity: 0.9; font-size: 15px; }
        .urgent-badge { display: inline-block; background: #fbbf24; color: #92400e; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 15px; }
        .content { background: #f8fafc; padding: 30px; }
        .webinar-card { background: white; border-radius: 12px; padding: 25px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .webinar-title { color: #1e293b; font-size: 20px; font-weight: 700; margin: 0 0 5px 0; }
        .webinar-subtitle { color: #64748b; font-size: 14px; margin: 0 0 20px 0; }
        .detail-row { display: flex; margin: 12px 0; font-size: 15px; }
        .detail-icon { width: 24px; margin-right: 10px; }
        .zoom-box { background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%); border: 2px solid #3b82f6; border-radius: 12px; padding: 20px; margin: 20px 0; }
        .zoom-title { color: #1e40af; font-size: 16px; font-weight: 700; margin: 0 0 15px 0; }
        .zoom-link { word-break: break-all; }
        .zoom-link a { color: #2563eb; text-decoration: none; font-weight: 600; }
        .zoom-details { margin-top: 12px; font-size: 14px; color: #475569; }
        .zoom-details p { margin: 5px 0; }
        .speakers-section { background: white; border-radius: 12px; padding: 20px; margin: 20px 0; }
        .speakers-title { color: #7c3aed; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 15px 0; }
        .speaker { padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
        .speaker:last-child { border-bottom: none; }
        .speaker-name { font-weight: 700; color: #1e293b; margin: 0; font-size: 15px; }
        .speaker-role { color: #64748b; font-size: 13px; margin: 2px 0 0 0; }
        .survey-box { background: linear-gradient(135deg, #dcfce7 0%, #d1fae5 100%); border: 2px solid #10b981; border-radius: 12px; padding: 20px; margin: 25px 0; text-align: center; }
        .survey-title { color: #065f46; font-size: 16px; font-weight: 700; margin: 0 0 10px 0; }
        .survey-text { color: #047857; font-size: 14px; margin: 0 0 15px 0; }
        .btn { display: inline-block; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; }
        .btn-primary { background: #2563eb; color: white; }
        .btn-survey { background: #10b981; color: white; }
        .btn-calendar { background: #64748b; color: white; margin: 5px; padding: 10px 20px; font-size: 13px; }
        .calendar-section { text-align: center; margin: 25px 0; }
        .calendar-label { color: #64748b; font-size: 13px; margin-bottom: 10px; }
        .tips-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        .tips-title { color: #92400e; font-size: 14px; font-weight: 700; margin: 0 0 10px 0; }
        .tips-list { margin: 0; padding-left: 20px; color: #78350f; font-size: 14px; }
        .tips-list li { margin: 6px 0; }
        .footer { text-align: center; padding: 25px; color: #64748b; font-size: 14px; }
        .footer-name { font-weight: 700; color: #1e293b; }
        .divider { height: 1px; background: #e2e8f0; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="urgent-badge">HAPPENING TOMORROW!</div>
          <h1>Student Mental Health: Thriving Beyond Grades</h1>
          <p>Your registration is confirmed!</p>
        </div>

        <div class="content">
          <p style="font-size: 16px;">Dear <strong>${attendee.name}</strong>,</p>
          <p>Thank you for registering! We're excited to have you join this important conversation about student mental health.</p>

          <div class="webinar-card">
            <div class="webinar-title">Webinar Details</div>
            <div class="webinar-subtitle">An honest conversation about academic stress</div>
            <div class="detail-row">📅 <strong style="margin-left: 8px;">Sunday, November 30, 2025</strong></div>
            <div class="detail-row">⏰ <strong style="margin-left: 8px;">6:00 PM NPT</strong> (Nepal Time)</div>
            <div class="detail-row">⏱️ <strong style="margin-left: 8px;">Duration:</strong> ~90 minutes</div>
          </div>

          <div class="zoom-box">
            <div class="zoom-title">🎥 Join Zoom Meeting</div>
            <div class="zoom-link">
              <a href="https://us06web.zoom.us/j/84978475078?pwd=EZIf1n9Pjy7bcozayzob4m1H9nlZTF.1">Click here to join the webinar</a>
            </div>
            <div class="zoom-details">
              <p><strong>Meeting ID:</strong> 849 7847 5078</p>
              <p><strong>Passcode:</strong> 090152</p>
            </div>
            <p style="font-size: 13px; color: #3b82f6; margin: 15px 0 0 0;">💡 <em>Bookmark this link now so you don't miss it!</em></p>
          </div>

          <div class="speakers-section">
            <div class="speakers-title">Featured Speakers</div>
            <div class="speaker">
              <p class="speaker-name">Dr. Aditi Pajiyar</p>
              <p class="speaker-role">Mental Health Fellow, NHAFN (Host)</p>
            </div>
            <div class="speaker">
              <p class="speaker-name">Dr. Amit Jha</p>
              <p class="speaker-role">Child & Adolescent Psychiatrist</p>
            </div>
            <div class="speaker">
              <p class="speaker-name">Nikita Pradhan</p>
              <p class="speaker-role">Clinical Psychologist</p>
            </div>
            <div class="speaker">
              <p class="speaker-name">Gopal Mahaseth</p>
              <p class="speaker-role">Educator</p>
            </div>
          </div>

          <div class="survey-box">
            <div class="survey-title">📋 Quick Pre-Webinar Survey</div>
            <div class="survey-text">Help us personalize the session for you! Takes only 2 minutes.</div>
            <a href="${surveyLink}" class="btn btn-survey">Complete Survey Now</a>
          </div>

          <div class="tips-box">
            <div class="tips-title">📝 Before the Webinar:</div>
            <ul class="tips-list">
              <li>Test your Zoom app and internet connection</li>
              <li>Find a quiet, comfortable space</li>
              <li>Prepare any questions you'd like to ask</li>
              <li>Keep a notebook handy for notes</li>
            </ul>
          </div>

          <div class="calendar-section">
            <p class="calendar-label">Add to your calendar:</p>
            <a href="${calendarLinks.google}" class="btn btn-calendar" target="_blank">Google Calendar</a>
            <a href="${calendarLinks.outlook}" class="btn btn-calendar" target="_blank">Outlook</a>
          </div>

          <div class="divider"></div>

          <p style="text-align: center; color: #64748b;">Questions? Contact us at <a href="mailto:mentalwellbeing1008@gmail.com" style="color: #2563eb;">mentalwellbeing1008@gmail.com</a></p>

          <div class="footer">
            <p style="font-size: 16px; color: #7c3aed; margin-bottom: 15px;"><strong>See you tomorrow!</strong></p>
            <p class="footer-name">Dr. Aditi Pajiyar</p>
            <p style="margin: 5px 0;">NHAFN Mental Health Fellow</p>
            <p style="margin: 5px 0;">National Health Action Force Nepal</p>
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
⏱️ Duration: ~90 minutes

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
