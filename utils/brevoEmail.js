/**
 * Brevo (Sendinblue) Email API Utility
 * Handles email sending via Brevo's transactional email API
 */

const Brevo = require('@getbrevo/brevo');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Initialize Brevo API client
let apiInstance = null;

const initBrevo = () => {
  if (!apiInstance && process.env.BREVO_API_KEY) {
    apiInstance = new Brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
  }
  return apiInstance;
};

/**
 * Log email attempt to database
 */
const logEmailAttempt = async (data) => {
  try {
    await prisma.emailLog.create({
      data: {
        toEmail: data.toEmail,
        toName: data.toName || null,
        subject: data.subject,
        type: data.type || 'notification',
        status: data.status,
        errorMessage: data.errorMessage || null,
        errorCode: data.errorCode || null,
        smtpResponse: data.smtpResponse || null,
        attendeeId: data.attendeeId || null,
        retryCount: data.retryCount || 0,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null
      }
    });
  } catch (error) {
    console.error('Failed to log email attempt:', error);
  }
};

/**
 * Send email using Brevo API
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.toName - Recipient name
 * @param {string} options.subject - Email subject
 * @param {string} options.htmlContent - HTML body
 * @param {string} options.textContent - Plain text body
 * @param {string} options.type - Email type for logging
 * @param {string} options.attendeeId - Attendee ID for tracking
 */
const sendEmail = async (options) => {
  const api = initBrevo();

  // Check if Brevo is configured
  if (!api || !process.env.BREVO_API_KEY) {
    console.log('Brevo API not configured, skipping email send');
    await logEmailAttempt({
      toEmail: options.to,
      toName: options.toName,
      subject: options.subject,
      type: options.type,
      status: 'skipped',
      errorMessage: 'Brevo API key not configured',
      attendeeId: options.attendeeId
    });
    return { success: false, skipped: true };
  }

  const fromName = process.env.EMAIL_FROM_NAME || 'Webinar Team';
  const fromEmail = process.env.EMAIL_FROM_EMAIL || 'noreply@example.com';

  const sendSmtpEmail = new Brevo.SendSmtpEmail();
  sendSmtpEmail.subject = options.subject;
  sendSmtpEmail.htmlContent = options.htmlContent;
  sendSmtpEmail.textContent = options.textContent;
  sendSmtpEmail.sender = { name: fromName, email: fromEmail };
  sendSmtpEmail.to = [{ email: options.to, name: options.toName || options.to }];

  try {
    const response = await api.sendTransacEmail(sendSmtpEmail);

    await logEmailAttempt({
      toEmail: options.to,
      toName: options.toName,
      subject: options.subject,
      type: options.type,
      status: 'sent',
      smtpResponse: JSON.stringify(response),
      attendeeId: options.attendeeId,
      metadata: { messageId: response.messageId }
    });

    console.log(`Email sent successfully to ${options.to}`);
    return { success: true, messageId: response.messageId };

  } catch (error) {
    const errorMessage = error.response?.body?.message || error.message || 'Unknown error';
    const errorCode = error.response?.status?.toString() || 'UNKNOWN';

    await logEmailAttempt({
      toEmail: options.to,
      toName: options.toName,
      subject: options.subject,
      type: options.type,
      status: 'failed',
      errorMessage: errorMessage,
      errorCode: errorCode,
      attendeeId: options.attendeeId
    });

    console.error(`Failed to send email to ${options.to}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
};

/**
 * NPT (Nepal Time) conversion utilities
 * NPT is UTC+5:45
 */
const NPT_OFFSET_MS = (5 * 60 + 45) * 60 * 1000; // 5 hours 45 minutes in milliseconds

const utcToNpt = (utcDate) => {
  return new Date(utcDate.getTime() + NPT_OFFSET_MS);
};

const nptToUtc = (nptDate) => {
  return new Date(nptDate.getTime() - NPT_OFFSET_MS);
};

const formatNptDateTime = (date) => {
  const npt = utcToNpt(date);
  return npt.toLocaleString('en-US', {
    timeZone: 'UTC', // We've already converted to NPT
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }) + ' NPT';
};

const getCurrentNptTime = () => {
  return utcToNpt(new Date());
};

module.exports = {
  sendEmail,
  logEmailAttempt,
  utcToNpt,
  nptToUtc,
  formatNptDateTime,
  getCurrentNptTime,
  NPT_OFFSET_MS
};
