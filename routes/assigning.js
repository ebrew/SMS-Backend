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

// Deleting an assigned subject for a particular teacher
router.get('/delete_assigned_subject/:assignedTeacherId/:subjectId', assignController.deleteAssignedSubject)

// Deleting an assigned class for a particular teacher
router.get('/delete_assigned_class/:assignedTeacherId', assignController.deleteAssignedClass)


module.exports = router;