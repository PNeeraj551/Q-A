const QnaPost = require('../models/QnaPost');
const Question = require('../models/Question');
const Reply = require('../models/Reply');
const { success, error } = require('../utils/responseUtils');

// GET /api/admin/analytics
const getAnalytics = async (req, res) => {
  try {
    const [totalPosts, totalQuestions, totalReplies, visibilityBreakdown, mostActiveTopics] =
      await Promise.all([
        QnaPost.countDocuments(),
        Question.countDocuments({ is_deleted: false }),
        Reply.countDocuments({ is_deleted: false }),

        QnaPost.aggregate([
          { $group: { _id: '$visibility', count: { $sum: 1 } } },
        ]),

        Question.aggregate([
          { $match: { is_deleted: false } },
          { $group: { _id: '$qna_id', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: 'qnaposts',
              localField: '_id',
              foreignField: '_id',
              as: 'post',
            },
          },
          { $unwind: '$post' },
          {
            $project: {
              _id: 0,
              qna_id: '$_id',
              title: '$post.title',
              question_count: '$count',
            },
          },
        ]),
      ]);

    const publicCount = visibilityBreakdown.find((v) => v._id === 'PUBLIC')?.count ?? 0;
    const privateCount = visibilityBreakdown.find((v) => v._id === 'PRIVATE')?.count ?? 0;

    return success(res, {
      total_posts: totalPosts,
      total_questions: totalQuestions,
      total_replies: totalReplies,
      visibility: { public: publicCount, private: privateCount },
      most_active_topics: mostActiveTopics,
    });
  } catch (err) {
    return error(res, 'Failed to load analytics.', 500);
  }
};

module.exports = { getAnalytics };
