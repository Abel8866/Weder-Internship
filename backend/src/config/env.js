const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config();

const rootDirectory = path.resolve(__dirname, '../..');
const configuredDatabase = process.env.DATABASE_FILE || './data/issue-tracker.sqlite';

module.exports = {
  port: Number.parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseFile: path.isAbsolute(configuredDatabase)
    ? configuredDatabase
    : path.resolve(rootDirectory, configuredDatabase)
};
