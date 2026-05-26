const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = require('../config/env');
const logger = require('./logger');

const BROADCAST_URL = `${SUPABASE_URL.replace(/\/$/, '')}/realtime/v1/api/broadcast`;

async function broadcastToChannel(channel, event, payload) {
  try {
    const res = await fetch(BROADCAST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        messages: [{ topic: channel, event, payload }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error('[broadcast] HTTP error', { status: res.status, channel, event, body });
    }
  } catch (err) {
    logger.error('[broadcast] fetch error', { message: err.message, channel, event });
  }
}

module.exports = { broadcastToChannel };
