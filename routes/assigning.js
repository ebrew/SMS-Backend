const express = require('express');
const router = express.Router();
const assignController = require('../controllers/assigning');

// Get all assigned teachers
router.get('/all', assignController.assignedTeachers);

// Assign classes and subjects to teachers
router.post('/classes_subjects', assignController.assignClassesAndSubjects);

// Get a specific teacher's active assigned classes
router.get('/all/:id', assignController.assignedTeacher);

module.exports = router;