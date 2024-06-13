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
router.patch('/update_details/:id', studentController.updateStudentDetails)

// Update student emegency contact info
router.patch('/update_emergency_info/:id', studentController.updateStudentEmergencyContact)

// Update student's parent's info
router.patch('/update_parent_details/:id', studentController.updateStudentParentDetails)

// Update student's parent's employment info
router.patch('/update_parent_employment/:id', studentController.updateParentEmployment)

// Update a student's class
router.patch('/update_student_class/:assignedClassId', studentController.updateStudentClass)

module.exports = router;