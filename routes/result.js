const express = require('express');
const router = express.Router();
const resultController = require('../controllers/result');


// Fetch class students' results for a particular academic term
router.get('/class_students/:academicTermId/:classSessionId', resultController.classStudentsResults)

// Fetch a single student results for a particular academic term
router.get('/single_student/:studentId/:academicTermId/:classSessionId', resultController.singleStudentResult)


module.exports = router;