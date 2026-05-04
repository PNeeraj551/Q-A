const success = (res, data, status = 200) => {
  return res.status(status).json(data);
};

const error = (res, message, status = 500) => {
  return res.status(status).json({ error: message });
};

module.exports = { success, error };
