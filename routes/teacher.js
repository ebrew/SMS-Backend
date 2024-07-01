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
router.get('/class_subjects/:teacherId/:classSessionId', teacherController.teacherClassSubjects)

// Create a new assessment
router.post('/assessment/create', teacherController.addAssessment);

// Get a particular subject assessment
router.get('/get_assessment/:id', teacherController.getAssessment)

// update a particular Assessment
router.put('/update_assessment/:id', teacherController.updateAssessment)

// Delete a particular Assessment
router.delete('/delete_assessment/:id', teacherController.deleteAssessment)

// Get all subject assessments for active academic term
router.get('/subject_assessments/:classSessionId/:subjectId', teacherController.allSubjectAssessments)

// Grade student
router.post('/grade_student', teacherController.gradeStudent);

// update a student's grade
router.put('/update_student_grade/:id', teacherController.updateStudentGrade)

module.exports = router;