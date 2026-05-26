const crypto = require('crypto');
const { HASH_SECRET } = require('../config/env');

function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(`${ip}${HASH_SECRET}`).digest('hex').slice(0, 32);
}

module.exports = { hashIp };
