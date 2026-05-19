const db = require('../config/supabase');

const COLS = 'id, title, description, visibility, status, created_by, end_at, created_at, updated_at';

async function findById(id) {
  const { data, error } = await db.from('qna_posts').select(COLS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function create(data) {
  const { data: row, error } = await db.from('qna_posts').insert(data).select(COLS).single();
  if (error) throw error;
  return row;
}

async function updateById(id, updates) {
  const { data, error } = await db.from('qna_posts').update(updates).eq('id', id).select(COLS).single();
  if (error) throw error;
  return data;
}

async function deleteById(id) {
  const { error } = await db.from('qna_posts').delete().eq('id', id);
  if (error) throw error;
}

async function addUser(qnaId, userId) {
  const { error } = await db.from('qna_allowed_users').insert({ qna_id: qnaId, user_id: userId });
  if (error && error.code !== '23505') throw error;
}

async function removeUser(qnaId, userId) {
  const { error } = await db.from('qna_allowed_users').delete().eq('qna_id', qnaId).eq('user_id', userId);
  if (error) throw error;
}

async function setAllowedUsers(qnaId, userIds) {
  await db.from('qna_allowed_users').delete().eq('qna_id', qnaId);
  if (!userIds || !userIds.length) return;
  const rows = userIds.map((uid) => ({ qna_id: qnaId, user_id: uid }));
  const { error } = await db.from('qna_allowed_users').insert(rows);
  if (error) throw error;
}

async function getAllowedUserIds(qnaId) {
  const { data, error } = await db.from('qna_allowed_users').select('user_id').eq('qna_id', qnaId);
  if (error) throw error;
  return (data || []).map((r) => r.user_id);
}

async function getUserAllowedQnaIds(userId) {
  const { data, error } = await db.from('qna_allowed_users').select('qna_id').eq('user_id', userId);
  if (error) throw error;
  return (data || []).map((r) => r.qna_id);
}

module.exports = {
  findById,
  create,
  updateById,
  deleteById,
  addUser,
  removeUser,
  setAllowedUsers,
  getAllowedUserIds,
  getUserAllowedQnaIds,
};
