const isBoardClosed = (post) =>
  !!(post?.status === 'CLOSED' || (!!post?.end_at && new Date() >= new Date(post.end_at)));

module.exports = { isBoardClosed };
