const db = require('../config/supabase');
const Question = require('../models/Question');
const { broadcastToChannel } = require('../utils/broadcast');
const { success, error } = require('../utils/responseUtils');
const { isBoardClosed } = require('../utils/boardUtils');
const { hashIp } = require('../utils/hashUtils');
const { stripHtml } = require('../utils/sanitize');
const { toggleDeviceVote } = require('../services/voteIntegrityService');
const slackService = require('../services/slackService');
const QnaPost = require('../models/QnaPost');
const logger = require('../utils/logger');
const { COOKIE_NAME } = require('../config/cookies');

// GET /api/qna/:qnaId/questions
const listQuestions = async (req, res) => {
  const { qnaId } = req.params;
  try {
    const userId = req.user?.user_id || req.userSession?.user_id || null;
    const deviceToken = req.deviceToken || req.cookies?.[COOKIE_NAME] || null;

    const questions = await Question.listByQna(qnaId);

    let likedSet;
    if (userId) {
      likedSet = await Question.getAllLikedByUser(userId);
    } else if (deviceToken) {
      const { data } = await db.from('anonymous_votes').select('question_id').eq('device_token', deviceToken);
      likedSet = new Set((data || []).map((r) => r.question_id));
    } else {
      likedSet = new Set();
    }

    const result = questions.map((q) => ({
      ...q,
      liked_by_me: likedSet.has(q.id),
    }));

    logger.info('questions listed', { qnaId, count: result.length });
    return success(res, { questions: result });
  } catch (err) {
    logger.error('listQuestions error', { err: err.message, qnaId });
    return error(res, 'Failed to load questions.', 500);
  }
};

// POST /api/qna/:qnaId/questions
const createQuestion = async (req, res) => {
  const { text } = req.body;
  const { qnaId } = req.params;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return error(res, 'Question text is required', 400);
  }
  const sanitized = stripHtml(text.replace(/\0/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim());
  if (sanitized.length > 5000) {
    return error(res, 'Question must be 5000 characters or fewer', 400);
  }
  if (isBoardClosed(req.qnaPost)) {
    return error(res, 'This Q&A board is closed. No new questions can be posted.', 403);
  }

  try {
    const isPublicSession = !!req.userSession;
    const isDeviceToken = !!req.deviceToken;

    let authorId, authorName;
    if (isPublicSession) {
      authorId = req.userSession.user_id;
      const anonymous = typeof req.body.is_anonymous === 'boolean'
        ? req.body.is_anonymous
        : req.userSession.is_anonymous;
      authorName = anonymous ? 'Anonymous' : (req.userSession.display_name || 'Anonymous');
    } else if (isDeviceToken) {
      authorId = null;
      const anonymous = req.body.is_anonymous !== false;
      authorName = (!anonymous && req.body.display_name) ? req.body.display_name : 'Anonymous';
    } else {
      authorId = req.user.user_id;
      authorName = req.user.name;
    }

    const question = await Question.create({
      qna_id: qnaId,
      text: sanitized,
      ...(authorId && { author_id: authorId }),
      author_name: authorName,
    });

    const result = { ...question, liked_by_me: false };

    logger.info('question created', { qnaId, questionId: question.id, authorId });

    await Promise.all([
      broadcastToChannel(`qna_${qnaId}`, 'question:new', result),
      broadcastToChannel('qna_global', 'question:count_change', { qna_id: qnaId, delta: 1 }),
    ]);

    return success(res, { question: result }, 201);
  } catch (err) {
    logger.error('createQuestion error', { err: err.message, qnaId });
    return error(res, 'Failed to post question.', 500);
  }
};

// PATCH /api/qna/:qnaId/questions/:qId
const updateQuestion = async (req, res) => {
  const { text } = req.body;
  const { qId, qnaId } = req.params;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return error(res, 'Question text is required', 400);
  }
  const sanitized = text.replace(/\0/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
  if (sanitized.length > 5000) {
    return error(res, 'Question must be 5000 characters or fewer', 400);
  }

  try {
    const question = await Question.findById(qId);
    if (!question || question.is_deleted) return error(res, 'Question not found', 404);

    const actorId = req.user?.user_id || req.userSession?.user_id;
    if (!actorId || (question.author_id !== actorId && req.user?.role !== 'admin')) {
      return error(res, 'Not authorized', 403);
    }

    const updated = await Question.updateById(qId, { text: sanitized, pushed_to_slack: false });
    const liked_by_me = await Question.isLikedByUser(qId, actorId);
    const result = { ...updated, liked_by_me };

    await broadcastToChannel(`qna_${qnaId}`, 'question:update', result);

    return success(res, { question: result });
  } catch (err) {
    logger.error('updateQuestion error', { err: err.message, qId });
    return error(res, 'Failed to update question.', 500);
  }
};

// DELETE /api/qna/:qnaId/questions/:qId
const deleteQuestion = async (req, res) => {
  const { qId, qnaId } = req.params;

  try {
    const question = await Question.findById(qId);
    if (!question || question.is_deleted) return error(res, 'Question not found', 404);

    const actorId = req.user?.user_id || req.userSession?.user_id;
    if (!actorId || (question.author_id !== actorId && req.user?.role !== 'admin')) {
      return error(res, 'Not authorized', 403);
    }

    await Question.softDeleteById(qId);

    logger.info('question deleted', { questionId: qId, qnaId });

    await Promise.all([
      broadcastToChannel(`qna_${qnaId}`, 'question:delete', { question_id: qId }),
      broadcastToChannel('qna_global', 'question:count_change', { qna_id: qnaId, delta: -1 }),
    ]);

    return success(res, { message: 'Question deleted' });
  } catch (err) {
    logger.error('deleteQuestion error', { err: err.message, questionId: qId });
    return error(res, 'Failed to delete question.', 500);
  }
};

// PATCH /api/qna/:qnaId/questions/:qId/like
const toggleLike = async (req, res) => {
  const { qId, qnaId } = req.params;
  const userId = req.user?.user_id || req.userSession?.user_id || null;
  const deviceToken = req.deviceToken || null;

  try {
    if (!userId && !deviceToken) return error(res, 'Authentication required to like', 401);
    if (isBoardClosed(req.qnaPost)) return error(res, 'This Q&A board is closed.', 403);

    const question = await Question.findById(qId);
    if (!question || question.is_deleted) return error(res, 'Question not found', 404);

    let likes_count, liked_by_me;

    if (deviceToken) {
      const ipHash = hashIp(req.ip);
      ({ liked_by_me, likes_count } = await toggleDeviceVote(
        qId,
        req.qnaPost?.id || null,
        deviceToken,
        ipHash,
        req.headers['user-agent'] || ''
      ));
    } else {
      const { data, error: rpcErr } = await db.rpc('toggle_question_like', {
        p_question_id: qId,
        p_user_id: userId,
      });

      if (!rpcErr && data?.[0]) {
        likes_count = data[0].likes_count;
        liked_by_me = data[0].liked_by_me;
      } else {
        if (rpcErr) console.error('[toggleLike] RPC error:', rpcErr);
        const already_liked = await Question.isLikedByUser(qId, userId);
        if (already_liked) {
          await db.from('question_likes').delete().eq('question_id', qId).eq('user_id', userId);
        } else {
          await db.from('question_likes').upsert({ question_id: qId, user_id: userId });
        }
        liked_by_me = !already_liked;
        const { count } = await db.from('question_likes').select('*', { count: 'exact', head: true }).eq('question_id', qId);
        likes_count = count || 0;
        await db.from('questions').update({ likes_count }).eq('id', qId);
      }
    }

    logger.info('question like toggled', { questionId: qId, userId, deviceToken: !!deviceToken, liked_by_me });
    await broadcastToChannel(`qna_${qnaId}`, 'question:like', { question_id: qId, likes_count });
    return success(res, { likes_count, liked_by_me });
  } catch (err) {
    logger.error('toggleLike error', { err: err.message, questionId: qId });
    return error(res, 'Failed to update like.', 500);
  }
};

// PATCH /api/qna/:qnaId/questions/:qId/view
const trackView = async (req, res) => {
  const { qId } = req.params;
  try {
    await db.rpc('increment_view_count', { p_question_id: qId });
    const question = await Question.findById(qId);
    if (!question) return error(res, 'Question not found', 404);
    return success(res, { view_count: question.view_count });
  } catch {
    return error(res, 'Failed to track view.', 500);
  }
};

// PATCH /api/qna/:qnaId/questions/:qId/accept-reply
const markAcceptedReply = async (req, res) => {
  const { qId, qnaId } = req.params;
  const { reply_id } = req.body;

  try {
    const question = await Question.findById(qId);
    if (!question || question.is_deleted) return error(res, 'Question not found', 404);

    if (question.author_id !== req.user.user_id && req.user.role !== 'admin') {
      return error(res, 'Not authorized', 403);
    }

    const updated = await Question.updateById(qId, { accepted_reply_id: reply_id || null });
    const liked_by_me = await Question.isLikedByUser(qId, req.user.user_id);
    const result = { ...updated, liked_by_me };

    await broadcastToChannel(`qna_${qnaId}`, 'question:update', result);

    return success(res, { question: result });
  } catch (err) {
    logger.error('markAcceptedReply error', { err: err.message, qId });
    return error(res, 'Failed to update accepted reply.', 500);
  }
};

// PATCH /api/qna/:qnaId/questions/:qId/slack-answer  (admin only)
const markAnsweredInSlack = async (req, res) => {
  const { qId, qnaId } = req.params;
  try {
    const question = await Question.findById(qId);
    if (!question || question.is_deleted) return error(res, 'Question not found', 404);
    const toggled = !question.answered_in_slack;
    const updated = await Question.updateById(qId, { answered_in_slack: toggled });
    await broadcastToChannel(`qna_${qnaId}`, 'question:update', updated);
    logger.info('slack answer toggled', { questionId: qId, answered_in_slack: toggled });
    return success(res, { question: updated });
  } catch (err) {
    logger.error('markAnsweredInSlack error', { err: err.message, questionId: qId });
    return error(res, 'Failed to update question.', 500);
  }
};

// PATCH /api/qna/:qnaId/questions/:qId/pin  (admin only)
const pinQuestion = async (req, res) => {
  const { qId, qnaId } = req.params;
  try {
    const question = await Question.findById(qId);
    if (!question || question.is_deleted) return error(res, 'Question not found', 404);
    const updated = await Question.updateById(qId, { is_pinned: !question.is_pinned });
    await broadcastToChannel(`qna_${qnaId}`, 'question:update', updated);
    logger.info('question pin toggled', { questionId: qId, is_pinned: updated.is_pinned });
    return success(res, { question: updated });
  } catch (err) {
    logger.error('pinQuestion error', { err: err.message, qId });
    return error(res, 'Failed to pin question.', 500);
  }
};

// POST /api/qna/:qnaId/questions/:qId/push-slack  (admin only)
const pushQuestionToSlack = async (req, res) => {
  const { qId, qnaId } = req.params;
  try {
    const question = await Question.findById(qId);
    if (!question || question.is_deleted) return error(res, 'Question not found', 404);
    if (question.pushed_to_slack) return error(res, 'This question has already been pushed to Slack.', 409);

    const board = await QnaPost.findById(qnaId);
    const result = await slackService.pushQuestion({ ...question, qna_id: qnaId, board_title: board?.title || qnaId });
    await Question.updateById(qId, { pushed_to_slack: true });
    logger.info('question pushed to Slack', { questionId: qId, qnaId });
    return success(res, { pushed: true, simulated: result.simulated });
  } catch (err) {
    logger.error('pushQuestionToSlack error', { err: err.message, questionId: qId });
    return error(res, 'Failed to push to Slack.', 500);
  }
};

module.exports = { listQuestions, createQuestion, updateQuestion, deleteQuestion, toggleLike, markAcceptedReply, trackView, markAnsweredInSlack, pushQuestionToSlack, pinQuestion };
