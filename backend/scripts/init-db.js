const { initializeDatabase } = require('../src/database/migrations');

initializeDatabase();
console.log('SQLite schema initialized.');
