const supabase = require('../../../../../_lib/supabase');
const { withAuth } = require('../../../../../_lib/auth');
const { sendSuccess, sendError, handleCors } = require('../../../../../_lib/response');

async function trackView(req, res) {
  const { qId } = req.query;

  try {
    const { error } = await supabase.rpc('increment_view_count', { p_question_id: qId });
    if (error) throw error;

    const { data: q } = await supabase.from('questions').select('view_count').eq('id', qId).single();
    if (!q) return sendError(res, 'Question not found', 404);

    return sendSuccess(res, { view_count: q.view_count });
  } catch (_) {
    return sendError(res, 'Failed to track view.', 500);
  }
}

module.exports = function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'PATCH') return sendError(res, 'Method not allowed', 405);
  return withAuth(trackView)(req, res);
};
