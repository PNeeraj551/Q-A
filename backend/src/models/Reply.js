const db = require('../config/supabase');

const COLS = 'id, question_id, qna_id, text, author_id, author_name, likes_count, is_deleted, created_at, updated_at';

async function findById(id) {
  const { data, error } = await db.from('replies').select(COLS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function listByQuestion(questionId) {
  const { data, error } = await db
    .from('replies')
    .select(COLS)
    .eq('question_id', questionId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function create(data) {
  const { data: row, error } = await db.from('replies').insert(data).select(COLS).single();
  if (error) throw error;
  return row;
}

async function updateById(id, updates) {
  const { data, error } = await db.from('replies').update(updates).eq('id', id).select(COLS).single();
  if (error) throw error;
  return data;
}

async function softDeleteById(id) {
  const { data, error } = await db.from('replies').update({ is_deleted: true }).eq('id', id).select(COLS).single();
  if (error) throw error;
  return data;
}

async function isLikedByUser(replyId, userId) {
  const { data } = await db
    .from('reply_likes')
    .select('reply_id')
    .eq('reply_id', replyId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

async function getAllLikedByUser(userId) {
  const { data, error } = await db
    .from('reply_likes')
    .select('reply_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set((data || []).map((r) => r.reply_id));
}

module.exports = { findById, listByQuestion, create, updateById, softDeleteById, isLikedByUser, getAllLikedByUser };
