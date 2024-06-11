const express = require('express');
const router = express.Router();
const studentController = require('../controllers/student');

// Create a new class with sections
router.post('/new_admission', studentController.admitStudent);

// Update a student's DP url
router.post('/update_dp/:id', studentController.updateStudentDP)

// Get all students
router.get('/all', studentController.allStudents);

module.exports = router;