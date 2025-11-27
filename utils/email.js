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
        .calendar-links { margin: 20px 0; text-align: center; }
        .footer { text-align: center; color: #64748b; font-size: 14px; margin-top: 20px; }
        .highlight { background: #e0f2fe; border: 1px solid #0284c7; padding: 15px; border-radius: 8px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Thank You for Registering!</h1>
          <p style="margin: 0; opacity: 0.9;">Your seat is confirmed</p>
        </div>
        <div class="content">
          <p>Hi ${attendee.name},</p>
          <p>Thank you so much for registering for our webinar on student mental health. We're truly grateful that you're taking this important step to join the conversation about mental wellbeing.</p>

          <div class="details">
            <h3 style="margin-top: 0; color: #2563eb;">${webinar.title}</h3>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Time:</strong> ${formattedTime}</p>
            <p><strong>Duration:</strong> ${webinar.duration} minutes</p>
            <p><strong>Speaker:</strong> Dr. Aditi Pajiyar</p>
          </div>

          ${webinar.meetingLink ? `
          <p style="text-align: center;">
            <a href="${webinar.meetingLink}" class="btn">Join Webinar</a>
          </p>
          ` : `
          <div class="highlight">
            <p style="margin: 0; color: #0369a1;"><strong>Meeting Link Coming Soon!</strong></p>
            <p style="margin: 10px 0 0 0; color: #0369a1;">We'll send you the meeting link via email before the webinar starts. Keep an eye on your inbox!</p>
          </div>
          `}

          <div class="calendar-links">
            <p><strong>Don't forget to add it to your calendar:</strong></p>
            <a href="${calendarLinks.google}" class="btn btn-secondary" target="_blank">Google Calendar</a>
            <a href="${calendarLinks.outlook}" class="btn btn-secondary" target="_blank">Outlook</a>
          </div>

          <p style="text-align: center; font-size: 18px; color: #2563eb; margin-top: 25px;"><strong>See you on Sunday!</strong></p>

          <div class="footer">
            <p>If you have any questions, feel free to reply to this email.</p>
            <p style="margin-top: 15px;">Warm regards,<br><strong>Dr. Aditi Pajiyar</strong><br>Mental Health Leadership Fellow, NHAFN</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    Thank You for Registering!

    Hi ${attendee.name},

    Thank you so much for registering for our webinar on student mental health. We're truly grateful that you're taking this important step to join the conversation about mental wellbeing.

    ${webinar.title}
    Date: ${formattedDate}
    Time: ${formattedTime}
    Duration: ${webinar.duration} minutes
    Speaker: Dr. Aditi Pajiyar

    ${webinar.meetingLink ? `Join Link: ${webinar.meetingLink}` : 'Meeting Link Coming Soon! We will send you the meeting link via email before the webinar starts. Keep an eye on your inbox!'}

    Add to Google Calendar: ${calendarLinks.google}

    See you on Sunday!

    Warm regards,
    Dr. Aditi Pajiyar
    Mental Health Leadership Fellow, NHAFN
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
