const db = require('../config/supabase');

const COLS = 'id, name, email, role, is_active, is_root, created_at';

async function findByEmail(email) {
  const { data, error } = await db.from('users').select(COLS).eq('email', email).eq('is_active', true).maybeSingle();
  if (error) throw error;
  return data;
}

async function findById(id) {
  const { data, error } = await db.from('users').select(COLS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function findAll(searchTerm) {
  let q = db.from('users').select(COLS).eq('is_active', true);
  if (searchTerm) {
    const term = searchTerm.replace(/'/g, "''");
    q = q.or(`name.ilike.%${term}%,email.ilike.%${term}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function findByIds(ids) {
  if (!ids || !ids.length) return [];
  const { data, error } = await db.from('users').select(COLS).in('id', ids);
  if (error) throw error;
  return data || [];
}

async function create(data) {
  const { data: row, error } = await db.from('users').insert(data).select(COLS).single();
  if (error) throw error;
  return row;
}

async function updateById(id, updates) {
  const { data, error } = await db.from('users').update(updates).eq('id', id).select(COLS).single();
  if (error) throw error;
  return data;
}

module.exports = { findByEmail, findById, findAll, findByIds, create, updateById };
