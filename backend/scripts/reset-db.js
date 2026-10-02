const fs = require('node:fs');
const { databaseFile } = require('../src/config/env');

for (const suffix of ['', '-shm', '-wal']) {
  const file = `${databaseFile}${suffix}`;
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

const { initializeDatabase } = require('../src/database/migrations');
initializeDatabase();
require('../prisma/seed');
