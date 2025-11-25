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

const sendConfirmationEmail = async (attendee, webinar, calendarLinks) => {
  // Skip if SMTP not configured
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('SMTP not configured, skipping email');
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
  const formattedTime = webinarDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 5px; }
        .btn-secondary { background: #64748b; }
        .calendar-links { margin: 20px 0; }
        .footer { text-align: center; color: #64748b; font-size: 14px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>You're Registered!</h1>
        </div>
        <div class="content">
          <p>Hi ${attendee.name},</p>
          <p>Thank you for registering for our webinar. We're excited to have you join us!</p>

          <div class="details">
            <h3>${webinar.title}</h3>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Time:</strong> ${formattedTime}</p>
            <p><strong>Duration:</strong> ${webinar.duration} minutes</p>
          </div>

          ${webinar.meetingLink ? `
          <p style="text-align: center;">
            <a href="${webinar.meetingLink}" class="btn">Join Webinar</a>
          </p>
          ` : `
          <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;"><strong>Meeting Link Coming Soon</strong></p>
            <p style="margin: 5px 0 0 0; color: #92400e;">We'll send you the Zoom/Google Meet link before the webinar starts.</p>
          </div>
          `}

          <div class="calendar-links">
            <p><strong>Add to your calendar:</strong></p>
            <a href="${calendarLinks.google}" class="btn btn-secondary" target="_blank">Google Calendar</a>
            <a href="${calendarLinks.outlook}" class="btn btn-secondary" target="_blank">Outlook</a>
          </div>

          <p>We'll send you a reminder before the webinar starts.</p>

          <div class="footer">
            <p>If you have any questions, feel free to reply to this email.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    You're Registered!

    Hi ${attendee.name},

    Thank you for registering for ${webinar.title}.

    Date: ${formattedDate}
    Time: ${formattedTime}
    Duration: ${webinar.duration} minutes

    ${webinar.meetingLink ? `Join Link: ${webinar.meetingLink}` : 'Meeting Link: We will send you the Zoom/Google Meet link before the webinar starts.'}

    Add to Google Calendar: ${calendarLinks.google}

    We'll send you a reminder before the webinar starts.
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: attendee.email,
      subject: `You're registered: ${webinar.title}`,
      text: textContent,
      html: htmlContent
    });

    // Update attendee record
    await prisma.attendee.update({
      where: { id: attendee.id },
      data: { emailSent: true }
    });

    console.log(`Confirmation email sent to ${attendee.email}`);
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
};

module.exports = { sendConfirmationEmail };
