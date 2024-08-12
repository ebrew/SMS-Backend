const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notifications');

// Forward list of students' results to parents for a particular academic term
router.post('/student/results_parent', notificationsController.sendStudentResultsToParent);

// Forward list of students' fees to parents for a particular academic term
router.post('/student/fees_parent', notificationsController.sendStudentFeesToParent);

// Send genearl reminder to parents
router.post('/reminder/parent', notificationsController.sendReminder);

module.exports = router;