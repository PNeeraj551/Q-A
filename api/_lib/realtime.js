// Broadcast a Realtime event to a channel using Supabase's REST broadcast API.
// No WebSocket connection needed from serverless functions.
async function broadcastToChannel(channel, event, payload) {
  try {
    const url = `${process.env.SUPABASE_URL}/realtime/v1/api/broadcast`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: channel,
            event,
            payload,
          },
        ],
      }),
    });
  } catch (_) {
    // Realtime broadcast is best-effort; never block the main response
  }
}

module.exports = { broadcastToChannel };
