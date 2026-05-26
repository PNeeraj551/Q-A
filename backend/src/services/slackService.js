const logger = require('../utils/logger');

/**
 * Placeholder Slack integration service.
 * When SLACK_WEBHOOK_URL is configured in env, replace the simulation block
 * with: await axios.post(process.env.SLACK_WEBHOOK_URL, payload)
 */

function buildPayload(question) {
  return {
    text: `*New question pushed from Q&A board*`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${question.text}*`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Asked by *${question.author_name || 'Anonymous'}* · ${question.likes_count ?? 0} votes · Board: \`${question.qna_id}\``,
          },
        ],
      },
    ],
  };
}

async function pushQuestion(question) {
  const payload = buildPayload(question);

  logger.info('[SlackService] pushQuestion — simulated (webhook not configured)', {
    questionId: question.id, boardId: question.qna_id, preview: question.text?.slice(0, 80),
  });

  // TODO: uncomment when SLACK_WEBHOOK_URL is set in environment
  // const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  // if (!webhookUrl) throw new Error('SLACK_WEBHOOK_URL is not configured');
  // await require('axios').post(webhookUrl, payload);

  return { success: true, simulated: true, payload };
}

module.exports = { pushQuestion };
