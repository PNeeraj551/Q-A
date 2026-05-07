const cron = require('node-cron');
const Session = require('../models/Session');

const startLifecycleCron = () => {
  cron.schedule('* * * * *', async () => {
    const now = new Date();

    try {
      // Transition 1: SCHEDULED → PRE_SESSION
      // Applies when pre_session_enabled=true AND now >= preSessionOpenAt AND now < planned_start_time
      const scheduledWithPreSession = await Session.find({
        session_status: 'SCHEDULED',
        pre_session_enabled: true,
      }).lean();

      const toPreSession = scheduledWithPreSession.filter((session) => {
        const preSessionOpenAt = new Date(
          session.planned_start_time.getTime() - session.pre_session_minutes * 60 * 1000
        );
        return now >= preSessionOpenAt && now < session.planned_start_time;
      });

      if (toPreSession.length > 0) {
        await Session.updateMany(
          { _id: { $in: toPreSession.map((s) => s._id) } },
          { $set: { session_status: 'PRE_SESSION', updated_at: now } }
        );
        try {
          const { getIO } = require('../sockets/io');
          const io = getIO();
          toPreSession.forEach((s) => {
            io.to(`session_${s._id}`).emit('session:state_changed', {
              session_id: s._id.toString(),
              new_status: 'PRE_SESSION',
            });
            console.log(`[cron] ${s._id} → PRE_SESSION`);
          });
        } catch (_) {}
      }

      // Transitions to ACTIVE_SESSION are intentionally omitted.
      // Sessions only go live when an admin manually triggers the status change.

    } catch (err) {
      console.error('[cron] Lifecycle tick error:', err.message);
    }
  });

  console.log('[cron] Lifecycle cron started');
};

module.exports = { startLifecycleCron };
