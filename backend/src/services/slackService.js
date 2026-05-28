const axios = require('axios');
const logger = require('../utils/logger');

function buildPayload(question) {
  const author = question.author_name || 'Anonymous';
  const board = question.board_title || question.qna_id;

  return {
    username: 'Q&A Board',
    icon_emoji: ':speech_balloon:',
    text: `New question on *${board}*`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '💬 New Question',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: question.text,
        },
      },
      { type: 'divider' },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `👤 *${author}*  ·  📋 ${board}`,
          },
        ],
      },
    ],
  };
}

async function pushQuestion(question) {
  const payload = buildPayload(question);

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('SLACK_WEBHOOK_URL is not configured');
  await axios.post(webhookUrl, payload);

  logger.info('[SlackService] pushQuestion — sent to Slack', {
    questionId: question.id, boardId: question.qna_id, preview: question.text?.slice(0, 80),
  });

  return { success: true, simulated: false };
}

module.exports = { pushQuestion };
