const express = require('express');
const router = express.Router();
const attendance = require('../controllers/attendance');

// Create or update a new Grading point
router.post('/mark', attendance.markAttendance);

// Fetch today's attendence
router.get('/class/today/:academicTermId/:classSessionId', attendance.todaysClassStudentsAttendance);

// Fetch class students' attendance for a particular period
router.post('/class/period', attendance.periodicClassStudentsAttendance);

module.exports = router;