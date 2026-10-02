const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { databaseFile } = require('../config/env');

fs.mkdirSync(path.dirname(databaseFile), { recursive: true });

const db = new Database(databaseFile);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

module.exports = db;
