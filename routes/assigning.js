const express = require('express');
const router = express.Router();
const assignController = require('../controllers/assigning');


// Assign a class to a teacher
router.post('/class', assignController.assignClass);

// Assign a subject to a teacher
router.post('/subject', assignController.assignSubject);

// Get a specific teacher's active assigned classes
router.get('/all/:id', assignController.assignedTeacher);

// Get all assigned teachers
router.get('/all', assignController.assignedTeachers);


module.exports = router;