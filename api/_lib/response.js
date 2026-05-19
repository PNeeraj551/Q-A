function sendSuccess(res, data, status = 200) {
  return res.status(status).json(data);
}

function sendError(res, message, status = 500) {
  return res.status(status).json({ error: message });
}

function setCors(req, res) {
  const origin = process.env.CLIENT_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function handleCors(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

// Normalize Supabase row (id → _id) and flatten qna_allowed_users
function formatPost(post) {
  if (!post) return null;
  const { qna_allowed_users, ...rest } = post;
  return {
    ...rest,
    allowed_users: (qna_allowed_users || []).map((r) => r.user_id),
    is_effectively_closed: rest.status === 'CLOSED' || (rest.end_at && new Date() >= new Date(rest.end_at)),
  };
}

function formatUser(user) {
  if (!user) return null;
  const { id, ...rest } = user;
  return { _id: id, ...rest };
}

function formatQuestion(q, userId) {
  if (!q) return null;
  const { question_likes, ...rest } = q;
  const likedByMe = userId
    ? (question_likes || []).some((l) => l.user_id === userId)
    : false;
  return { ...rest, liked_by_me: likedByMe, likes: undefined };
}

function formatReply(r) {
  return r || null;
}

module.exports = { sendSuccess, sendError, setCors, handleCors, formatPost, formatUser, formatQuestion, formatReply };
