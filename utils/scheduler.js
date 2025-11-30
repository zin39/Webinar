/**
 * Email Scheduler Service
 * Handles scheduled email sending using node-cron
 */

const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { sendReminderEmail, sendPostWebinarEmail } = require('./email');
const { utcToNpt, formatNptDateTime, getCurrentNptTime } = require('./brevoEmail');

const prisma = new PrismaClient();

let schedulerJob = null;

/**
 * Initialize the email scheduler
 * Checks every minute for scheduled emails that need to be sent
 */
const initScheduler = () => {
  if (schedulerJob) {
    console.log('Scheduler already running');
    return;
  }

  console.log('Initializing email scheduler...');

  // Run every minute
  schedulerJob = cron.schedule('* * * * *', async () => {
    await checkAndSendScheduledEmails();
  });

  console.log('Email scheduler started - checking every minute');
};

/**
 * Stop the scheduler
 */
const stopScheduler = () => {
  if (schedulerJob) {
    schedulerJob.stop();
    schedulerJob = null;
    console.log('Email scheduler stopped');
  }
};

/**
 * Check for scheduled emails and send them if due
 */
const checkAndSendScheduledEmails = async () => {
  try {
    const now = new Date();

    // Get all enabled scheduled emails where time has passed and status is pending
    const scheduledEmails = await prisma.scheduledEmail.findMany({
      where: {
        enabled: true,
        status: 'pending',
        scheduledTime: {
          lte: now
        }
      }
    });

    for (const schedule of scheduledEmails) {
      console.log(`Processing scheduled email slot ${schedule.slot}...`);
      await processScheduledEmail(schedule);
    }
  } catch (error) {
    console.error('Error checking scheduled emails:', error);
  }
};

/**
 * Process a single scheduled email
 * @param {Object} schedule - The scheduled email record
 */
const processScheduledEmail = async (schedule) => {
  try {
    // Mark as running
    await prisma.scheduledEmail.update({
      where: { id: schedule.id },
      data: { status: 'running' }
    });

    // Slot 4 is post-webinar, slots 1-3 are pre-webinar reminders
    const isPostWebinar = schedule.slot === 4;
    const trackingField = isPostWebinar ? 'postWebinarSent' : `reminder${schedule.slot}Sent`;

    // Get all attendees who haven't received this email
    const attendees = await prisma.attendee.findMany({
      where: {
        [trackingField]: false
      }
    });

    const emailType = isPostWebinar ? 'post-webinar survey' : `reminder slot ${schedule.slot}`;
    console.log(`Found ${attendees.length} attendees for ${emailType}`);

    let successCount = 0;
    let failCount = 0;

    // Send emails with a small delay between each
    for (const attendee of attendees) {
      try {
        // Ensure attendee has a survey token
        if (!attendee.surveyToken) {
          const crypto = require('crypto');
          const token = crypto.randomBytes(32).toString('hex');
          await prisma.attendee.update({
            where: { id: attendee.id },
            data: { surveyToken: token }
          });
          attendee.surveyToken = token;
        }

        // Use different email function based on slot type
        let result;
        if (isPostWebinar) {
          result = await sendPostWebinarEmail(attendee, schedule.subject);
        } else {
          result = await sendReminderEmail(attendee, schedule.slot, schedule.subject);
        }

        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        console.error(`Failed to send ${emailType} email to ${attendee.email}:`, err);
        failCount++;
      }
    }

    // Mark as completed
    await prisma.scheduledEmail.update({
      where: { id: schedule.id },
      data: {
        status: 'completed',
        lastRun: new Date()
      }
    });

    console.log(`Scheduled email slot ${schedule.slot} (${emailType}) completed: ${successCount} sent, ${failCount} failed`);

  } catch (error) {
    console.error(`Error processing scheduled email slot ${schedule.slot}:`, error);

    // Mark as pending again so it can be retried
    await prisma.scheduledEmail.update({
      where: { id: schedule.id },
      data: { status: 'pending' }
    });
  }
};

/**
 * Manually trigger a scheduled email slot
 * @param {number} slot - The slot number (1, 2, or 3)
 */
const triggerScheduledEmail = async (slot) => {
  const schedule = await prisma.scheduledEmail.findUnique({
    where: { slot: slot }
  });

  if (!schedule) {
    throw new Error(`Scheduled email slot ${slot} not found`);
  }

  // Reset status to pending and process
  await prisma.scheduledEmail.update({
    where: { id: schedule.id },
    data: { status: 'pending' }
  });

  // Get updated schedule
  const updatedSchedule = await prisma.scheduledEmail.findUnique({
    where: { slot: slot }
  });

  await processScheduledEmail(updatedSchedule);

  return updatedSchedule;
};

/**
 * Get scheduler status
 */
const getSchedulerStatus = async () => {
  const schedules = await prisma.scheduledEmail.findMany({
    orderBy: { slot: 'asc' }
  });

  const nptNow = getCurrentNptTime();

  return {
    isRunning: schedulerJob !== null,
    currentTimeNpt: formatNptDateTime(new Date()),
    schedules: schedules.map(s => ({
      ...s,
      scheduledTimeNpt: s.scheduledTime ? formatNptDateTime(s.scheduledTime) : null
    }))
  };
};

/**
 * Initialize default schedule slots if they don't exist
 * Slots 1-3 are pre-webinar reminders, slot 4 is post-webinar survey
 */
const initDefaultSchedules = async () => {
  for (let slot = 1; slot <= 4; slot++) {
    const existing = await prisma.scheduledEmail.findUnique({
      where: { slot: slot }
    });

    if (!existing) {
      const defaultSubjects = {
        1: '📅 Reminder: Student Mental Health Webinar Tomorrow!',
        2: '⏰ Starting in a Few Hours: Student Mental Health Webinar',
        3: '🚀 Starting NOW: Join the Student Mental Health Webinar!',
        4: '📝 Share Your Feedback: Student Mental Health Webinar Survey'
      };

      await prisma.scheduledEmail.create({
        data: {
          slot: slot,
          subject: defaultSubjects[slot],
          enabled: false,
          status: 'pending'
        }
      });

      const slotType = slot === 4 ? 'post-webinar survey' : `pre-webinar reminder ${slot}`;
      console.log(`Created default schedule for slot ${slot} (${slotType})`);
    }
  }
};

/**
 * Update a scheduled email configuration
 * @param {number} slot - The slot number
 * @param {Object} data - The update data
 */
const updateSchedule = async (slot, data) => {
  // Convert NPT time to UTC if provided
  let updateData = { ...data };

  if (data.scheduledTimeNpt) {
    // Parse the NPT datetime string and convert to UTC
    const nptDate = new Date(data.scheduledTimeNpt);
    const NPT_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;
    updateData.scheduledTime = new Date(nptDate.getTime() - NPT_OFFSET_MS);
    delete updateData.scheduledTimeNpt;
  }

  // If enabling and setting time, reset status to pending
  if (data.enabled && data.scheduledTime) {
    updateData.status = 'pending';
  }

  return prisma.scheduledEmail.update({
    where: { slot: slot },
    data: updateData
  });
};

/**
 * Reset a schedule to pending status
 * @param {number} slot - The slot number
 */
const resetSchedule = async (slot) => {
  return prisma.scheduledEmail.update({
    where: { slot: slot },
    data: { status: 'pending' }
  });
};

module.exports = {
  initScheduler,
  stopScheduler,
  checkAndSendScheduledEmails,
  triggerScheduledEmail,
  getSchedulerStatus,
  initDefaultSchedules,
  updateSchedule,
  resetSchedule
};
