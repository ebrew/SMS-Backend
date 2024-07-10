const express = require('express');
const router = express.Router();
const studentController = require('../controllers/student');

// Create a new class with sections
router.post('/new_admission', studentController.admitStudent);

// Update a student's DP url
router.post('/update_dp/:id', studentController.updateStudentDP)

// Get all students
router.get('/all', studentController.allStudents);

// Update student details
router.put('/update_details/:id', studentController.updateStudentDetails)

// Update student emegency contact info
router.put('/update_emergency_info/:id', studentController.updateStudentEmergencyContact)

// Update student's parent's info
router.put('/update_parent_details/:id', studentController.updateStudentParentDetails)

// Update student's parent's employment info
router.put('/update_parent_employment/:id', studentController.updateParentEmployment)

// Update a student's class
router.put('/update_student_class/:assignedClassId', studentController.updateStudentClass)

// Fetch academic year classSession students
router.get('/class_students/:academicYearId/:classSessionId', studentController.classStudents)

module.exports = router;