const express = require('express');
const router = express.Router();
const assignController = require('../controllers/assigning');

// Get all assigned teachers
router.get('/all', assignController.assignedTeachers);

// Assign classes and subjects to teachers
router.post('/classes_subjects', assignController.assignClassesAndSubjects);

// Get a teacher's active assigned classes
router.get('/all/:id', assignController.assignedTeacher);

// // Get all active assigned teachers
// router.get('/all_active', assignController.activeAssignedTeachers);

// // Get a teacher's active assigned classes
// router.get('/all_active/:id', assignController.activeAssignedTeacher);

module.exports = router;