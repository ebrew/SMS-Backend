const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notifications');

// Forward student results to parent for a particular academic term
router.post('/student/results_parent', notificationsController.sendStudentResultsToParent);

module.exports = router;