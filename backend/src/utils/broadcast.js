const https = require('https');
const { URL } = require('url');
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = require('../config/env');

const _parsed = new URL(`${SUPABASE_URL}/realtime/v1/api/broadcast`);

function broadcastToChannel(channel, event, payload) {
  const body = JSON.stringify({
    messages: [{
      topic: channel,
      event,
      payload,
    }],
  });

  const req = https.request({
    hostname: _parsed.hostname,
    path: _parsed.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Content-Length': Buffer.byteLength(body),
    },
  }, (res) => {
    res.resume();
  });

  req.on('error', () => {});
  req.write(body);
  req.end();
}

module.exports = { broadcastToChannel };
