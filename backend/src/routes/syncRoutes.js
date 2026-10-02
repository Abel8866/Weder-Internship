const express = require('express');
const { validate } = require('../middleware/validate');
const { syncRequest } = require('../validators/reportSchemas');
const controller = require('../controllers/syncController');

const router = express.Router();
router.post('/', validate(syncRequest), controller.synchronize);

module.exports = router;
