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
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb; }
        .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 5px; }
        .btn-secondary { background: #64748b; }
        .btn-survey { background: #10b981; }
        .calendar-links { margin: 20px 0; text-align: center; }
        .footer { text-align: center; color: #64748b; font-size: 14px; margin-top: 20px; }
        .highlight { background: #e0f2fe; border: 1px solid #0284c7; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .expect-list { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .expect-list ul { margin: 0; padding-left: 20px; }
        .expect-list li { margin: 8px 0; }
        .next-steps { background: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .next-steps ol { margin: 10px 0; padding-left: 20px; }
        .next-steps li { margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Thank You for Registering!</h1>
          <p style="margin: 0; opacity: 0.9;">Your seat is confirmed for the Student Mental Health Webinar</p>
        </div>
        <div class="content">
          <p>Dear ${attendee.name},</p>
          <p>Thank you for registering for our Student Mental Health Webinar!</p>

          <div class="details">
            <h3 style="margin-top: 0; color: #2563eb;">Webinar Details</h3>
            <p>📅 <strong>Date:</strong> Sunday, November 30, 2025</p>
            <p>⏰ <strong>Time:</strong> 6:00 PM - 7:30 PM NST</p>
            <p>💻 <strong>Platform:</strong> Zoom</p>
          </div>

          <div class="expect-list">
            <h3 style="margin-top: 0; color: #2563eb;">What to Expect:</h3>
            <ul>
              <li>Understanding academic stress and mental health</li>
              <li>Practical coping strategies you can use immediately</li>
              <li>Resources for seeking help in Nepal</li>
              <li>Interactive Q&A session</li>
              <li>Supportive, judgment-free space</li>
            </ul>
          </div>

          <div class="next-steps">
            <h3 style="margin-top: 0; color: #92400e;">📋 Next Steps:</h3>
            <ol>
              <li>We'll send you the <strong>Zoom link on November 29</strong> (one day before)</li>
              <li>Please complete this quick <a href="${surveyLink}" style="color: #2563eb; font-weight: bold;">pre-webinar survey</a> (takes 2 minutes)</li>
              <li>Mark your calendar and set a reminder!</li>
            </ol>
          </div>

          <p style="text-align: center; margin: 25px 0;">
            <a href="${surveyLink}" class="btn btn-survey">Complete Pre-Webinar Survey</a>
          </p>

          <div class="calendar-links">
            <p><strong>Add to your calendar:</strong></p>
            <a href="${calendarLinks.google}" class="btn btn-secondary" target="_blank">Google Calendar</a>
            <a href="${calendarLinks.outlook}" class="btn btn-secondary" target="_blank">Outlook</a>
          </div>

          <p style="text-align: center; color: #64748b; margin-top: 20px;">Questions? Reach out anytime at <a href="mailto:mentalwellbeing1008@gmail.com" style="color: #2563eb;">mentalwellbeing1008@gmail.com</a></p>

          <p style="text-align: center; font-size: 18px; color: #2563eb; margin-top: 25px;"><strong>Looking forward to seeing you there!</strong></p>

          <div class="footer">
            <p style="margin-top: 15px;">Warm regards,<br><strong>Dr. Aditi Pajiyar</strong><br>NHAFN Mental Health Fellow<br>📧 <a href="mailto:mentalwellbeing1008@gmail.com" style="color: #64748b;">mentalwellbeing1008@gmail.com</a></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Dear ${attendee.name},

Thank you for registering for our Student Mental Health Webinar!

WEBINAR DETAILS:
📅 Date: Sunday, November 30, 2025
⏰ Time: 6:00 PM - 7:30 PM NST
💻 Platform: Zoom

WHAT TO EXPECT:
• Understanding academic stress and mental health
• Practical coping strategies you can use immediately
• Resources for seeking help in Nepal
• Interactive Q&A session
• Supportive, judgment-free space

NEXT STEPS:
1. We'll send you the Zoom link on November 29 (one day before)
2. Please complete this quick pre-webinar survey: ${surveyLink} (takes 2 minutes)
3. Mark your calendar and set a reminder!

Add to Google Calendar: ${calendarLinks.google}

Questions? Reach out anytime at mentalwellbeing1008@gmail.com

Looking forward to seeing you there!

Warm regards,
Dr. Aditi Pajiyar
NHAFN Mental Health Fellow
Email: mentalwellbeing1008@gmail.com
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
