const db = require('../config/supabase');

const COLS = 'id, email, otp_hash, expires_at, used, attempts, created_at';

async function findActiveByEmail(email) {
  const { data, error } = await db
    .from('otps')
    .select(COLS)
    .eq('email', email)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function create(data) {
  const { data: row, error } = await db.from('otps').insert(data).select(COLS).single();
  if (error) throw error;
  return row;
}

async function clearByEmail(email) {
  await db.rpc('delete_expired_otps', { p_email: email });
  const { error } = await db.from('otps').delete().eq('email', email);
  if (error) throw error;
}

async function updateById(id, updates) {
  const { data, error } = await db.from('otps').update(updates).eq('id', id).select(COLS).single();
  if (error) throw error;
  return data;
}

async function deleteById(id) {
  const { error } = await db.from('otps').delete().eq('id', id);
  if (error) throw error;
}

module.exports = { findActiveByEmail, create, clearByEmail, updateById, deleteById };
