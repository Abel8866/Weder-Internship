const reportService = require('../services/reportService');

function listReports(req, res) {
  const result = reportService.list(req.query);
  res.json({
    data: result.data,
    pagination: {
      page: req.query.page,
      pageSize: req.query.pageSize,
      total: result.total
    }
  });
}

function getReport(req, res) {
  res.json({ data: reportService.getById(req.params.id) });
}

function transitionStatus(req, res) {
  const report = reportService.transition(req.params.id, req.body, req.actorRole || 'coordinator');
  res.json({ data: report });
}

function getHistory(req, res) {
  res.json({ reportId: req.params.id, events: reportService.history(req.params.id) });
}

module.exports = { listReports, getReport, transitionStatus, getHistory };
