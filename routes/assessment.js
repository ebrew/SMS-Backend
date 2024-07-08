const express = require('express');
const router = express.Router();
const assessmentController = require('../controllers/assessment');


// Create a new assessment
router.post('/assessment/create', assessmentController.addAssessment);

// Get a particular subject assessment
router.get('/get_assessment/:id', assessmentController.getAssessment)

// update a particular Assessment
router.put('/update_assessment/:id', assessmentController.updateAssessment)

// Delete a particular Assessment
router.delete('/delete_assessment/:id', assessmentController.deleteAssessment)

// Get all subject assessments for active academic term
router.get('/subject_assessments/:classSessionId/:subjectId', assessmentController.allSubjectAssessments)

// Grade student
router.post('/grade_student', assessmentController.gradeStudent);

// update a student's grade
router.put('/update_student_grade/:id', assessmentController.updateStudentGrade)

// Students' grades for a particular assessment
router.get('/assessment_grades/:id', assessmentController.studentsAssessmentGrades)

// Students' grades for a particular subject's assessments
router.get('/subject_assessment_grades/:academicTermId/:classSessionId/:subjectId', assessmentController.subjectAssessmentsGrades)

module.exports = router;