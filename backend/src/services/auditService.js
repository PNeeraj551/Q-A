'use strict';
const crypto = require('crypto');
const db = require('../config/supabase');
const logger = require('../utils/logger');

const ACTIONS = {
  USER_LOCKED: 'USER_LOCKED',
  USER_UNLOCKED: 'USER_UNLOCKED',
  USER_SOFT_DELETED: 'USER_SOFT_DELETED',
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
};

function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

async function logAction({ action, targetUserId, targetUserEmail, adminId, adminEmail, ip, metadata }) {
  try {
    const { error } = await db.from('admin_audit_logs').insert({
      action,
      target_user_id: targetUserId || null,
      target_user_email: targetUserEmail || null,
      admin_id: adminId,
      admin_email: adminEmail,
      ip_hash: hashIp(ip),
      metadata: metadata || null,
    });
    if (error) {
      logger.error('audit log insert failed', { err: error.message, action });
    } else {
      logger.info('audit log written', { action, targetUserEmail, adminEmail });
    }
  } catch (err) {
    logger.error('auditService.logAction threw', { err: err.message, action });
  }
}

module.exports = { logAction, ACTIONS, hashIp };
