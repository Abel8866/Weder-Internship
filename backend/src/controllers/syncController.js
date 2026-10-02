const { syncReports } = require('../services/syncService');
const { AppError } = require('../utils/errors');

function synchronize(req, res) {
  const key = req.get('Idempotency-Key');
  if (!key || key.trim().length < 1 || key.length > 200) {
    throw new AppError(400, 'MISSING_IDEMPOTENCY_KEY', 'Idempotency-Key header is required');
  }
  res.json({ ...syncReports(req.body.items, key), requestId: req.id });
}

module.exports = { synchronize };
