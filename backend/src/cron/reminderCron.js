const cron = require('node-cron');
const Session = require('../models/Session');
const Notification = require('../models/Notification');
const { getIO } = require('../sockets/io');

const startReminderCron = () => {
  // Check every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    const now = new Date();
    const oneDayPlus = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const oneHourPlus = new Date(now.getTime() + 60 * 60 * 1000);

    try {
      // Find upcoming scheduled sessions
      const sessions = await Session.find({
        session_status: 'SCHEDULED'
      });

      for (const session of sessions) {
        const startTime = session.planned_start_time.getTime();
        const diff = startTime - now.getTime();
        const isPrivate = session.access_type === 'PRIVATE';

        let type = null;
        // 24H reminder only for Private sessions
        if (isPrivate && diff > 0 && diff <= 24 * 60 * 60 * 1000 && diff > 60 * 60 * 1000 && !session.reminders_sent.includes('24H')) {
          type = '24H';
        } 
        // 1H reminder for both Private and Public sessions
        else if (diff > 0 && diff <= 60 * 60 * 1000 && !session.reminders_sent.includes('1H')) {
          type = '1H';
        }

        if (type) {
          const recipients = [...(session.assigned_participants || []), session.created_by];
          const message = `Reminder: "${session.session_title}" starts in about ${type === '24H' ? '24 hours' : '1 hour'}.`;

          const { sendNotification } = require('../utils/notificationService');
          
          // Create notifications for all recipients
          await Promise.all(recipients.map(rid => 
            sendNotification({
              recipientId: rid,
              message,
              sessionId: session._id,
              type: 'REMINDER'
            }).catch(err => console.error(`[ReminderCron] Notification failed for user ${rid}:`, err.message))
          ));

          // Mark as sent
          session.reminders_sent.push(type);
          await session.save();

          console.log(`[cron] Sent ${type} reminders for session ${session._id}`);
        }
      }
    } catch (err) {
      console.error('[cron] Reminder tick error:', err.message);
    }
  });

  console.log('[cron] Reminder cron started');
};

module.exports = { startReminderCron };
