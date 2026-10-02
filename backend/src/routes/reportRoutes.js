const express = require('express');
const { validate } = require('../middleware/validate');
const { listQuery, transitionRequest, historyQuery } = require('../validators/reportSchemas');
const controller = require('../controllers/reportController');

const router = express.Router();

router.get('/', validate(listQuery, 'query'), controller.listReports);
router.get('/:id/history', validate(historyQuery, 'query'), controller.getHistory);
router.patch('/:id/status', validate(transitionRequest), controller.transitionStatus);
router.get('/:id', controller.getReport);

module.exports = router;
