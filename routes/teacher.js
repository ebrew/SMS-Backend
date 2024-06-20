const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacher');

// Get all classes
router.get('/all', teacherController.allTeachers);

// Get a teacher's assigned classes after login
router.get('/assigned_classes/:id', teacherController.getAssignedTeacherClass)

// Get a teacher's assigned class's students
router.get('/class_students/:id', teacherController.teacherClassStudents)

// Get a teacher's assigned class's subjects 
router.get('/class_subjects/:id', teacherController.teacherClassSubjects)

module.exports = router;