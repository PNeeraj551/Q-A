const crypto = require('crypto');
const db = require('../config/supabase');

const COLS = 'id, qna_id, user_id, email, display_name, is_anonymous, session_token, verified_at, created_at';

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function findByToken(token) {
  const { data, error } = await db
    .from('user_sessions')
    .select(COLS)
    .eq('session_token', token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findByBoardAndUser(qnaId, userId) {
  const { data, error } = await db
    .from('user_sessions')
    .select(COLS)
    .eq('qna_id', qnaId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function upsert({ qnaId, userId, email, displayName, isAnonymous }) {
  const existing = await findByBoardAndUser(qnaId, userId);
  if (existing) return existing;

  const session_token = generateToken();
  const { data, error } = await db
    .from('user_sessions')
    .insert({
      qna_id: qnaId,
      user_id: userId,
      email,
      display_name: displayName || null,
      is_anonymous: isAnonymous ?? true,
      session_token,
      verified_at: new Date().toISOString(),
    })
    .select(COLS)
    .single();
  if (error) throw error;
  return data;
}

async function updateAnonymous(id, isAnonymous) {
  const { data, error } = await db
    .from('user_sessions')
    .update({ is_anonymous: isAnonymous })
    .eq('id', id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data;
}

module.exports = { findByToken, findByBoardAndUser, upsert, updateAnonymous, generateToken };
