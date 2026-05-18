const mongoose = require('mongoose');
const logger = require('../utils/logger');

const { MONGO_URI } = require('./env');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGO_URI);
    logger.info(`[db] Connected: ${conn.connection.host}`);
  } catch (err) {
    logger.error(`[db] Connection failed: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
