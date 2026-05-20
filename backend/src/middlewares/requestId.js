const { AsyncLocalStorage } = require('async_hooks');
const { randomUUID } = require('crypto');

const als = new AsyncLocalStorage();

const getStore = () => als.getStore() || {};

const requestIdMiddleware = (req, res, next) => {
  const requestId = randomUUID();
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);
  als.run({ requestId }, next);
};

module.exports = { requestIdMiddleware, getStore };
