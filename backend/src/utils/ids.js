const { randomUUID } = require('node:crypto');

function newId() {
  return randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = { newId, nowIso };
