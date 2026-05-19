const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = require('../config/env');

const BROADCAST_URL = `${SUPABASE_URL}/realtime/v1/api/broadcast`;

async function broadcastToChannel(channel, event, payload) {
  try {
    await fetch(BROADCAST_URL, {
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
  } catch {
    // non-fatal — client sees stale data until next poll or refresh
  }
}

module.exports = { broadcastToChannel };
