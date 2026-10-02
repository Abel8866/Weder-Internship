const express = require('express');
const { randomUUID } = require('node:crypto');
const db = require('./database/connection');
const reportRoutes = require('./routes/reportRoutes');
const syncRoutes = require('./routes/syncRoutes');
const { notFound } = require('./middleware/notFound');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => {
  req.id = req.get('X-Request-Id') || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

app.get('/health', (req, res) => {
  const database = db.prepare('SELECT 1 AS ok').get();
  res.json({ status: 'ok', database: database.ok === 1 ? 'ok' : 'error', requestId: req.id });
});

app.use('/api/reports/sync', syncRoutes);
app.use('/api/reports', reportRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
