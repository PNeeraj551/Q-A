const db = require('../config/supabase');

const COLS = 'id, qna_id, text, author_id, author_name, likes_count, reply_count, view_count, accepted_reply_id, answered_in_slack, is_deleted, created_at, updated_at';

async function findById(id) {
  const { data, error } = await db.from('questions').select(COLS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function listByQna(qnaId) {
  const { data, error } = await db
    .from('questions')
    .select(COLS)
    .eq('qna_id', qnaId)
    .eq('is_deleted', false)
    .order('likes_count', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return data || [];
}

async function create(data) {
  const { data: row, error } = await db.from('questions').insert(data).select(COLS).single();
  if (error) throw error;
  return row;
}

async function updateById(id, updates) {
  const { data, error } = await db.from('questions').update(updates).eq('id', id).select(COLS).single();
  if (error) throw error;
  return data;
}

async function softDeleteById(id) {
  const { data, error } = await db.from('questions').update({ is_deleted: true }).eq('id', id).select(COLS).single();
  if (error) throw error;
  return data;
}

async function countByQnaId(qnaId) {
  const { count, error } = await db.from('questions').select('*', { count: 'exact', head: true }).eq('qna_id', qnaId).eq('is_deleted', false);
  if (error) throw error;
  return count || 0;
}

async function getLikedQuestionIds(questionIds, userId) {
  if (!questionIds.length) return new Set();
  const { data, error } = await db
    .from('question_likes')
    .select('question_id')
    .eq('user_id', userId)
    .in('question_id', questionIds);
  if (error) throw error;
  return new Set((data || []).map((r) => r.question_id));
}

async function isLikedByUser(questionId, userId) {
  const { data } = await db
    .from('question_likes')
    .select('question_id')
    .eq('question_id', questionId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

async function getAllLikedByUser(userId) {
  const { data, error } = await db
    .from('question_likes')
    .select('question_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set((data || []).map((r) => r.question_id));
}

module.exports = {
  findById,
  listByQna,
  create,
  updateById,
  softDeleteById,
  countByQnaId,
  getLikedQuestionIds,
  isLikedByUser,
  getAllLikedByUser,
};
