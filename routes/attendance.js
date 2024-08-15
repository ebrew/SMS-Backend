const express = require('express');
const router = express.Router();
const attendance = require('../controllers/attendance');

// Create or update a new Grading point
router.post('/mark', attendance.markAttendance);

// fetch a class students' attendance  for a particular date
router.get('/class/date/:academicTermId/:classSessionId/:date', attendance.ClassStudentsAttendance);

// Fetch a student's attendance for a particular period
router.post('/student/period', attendance.periodicStudentsAttendance);

module.exports = router;