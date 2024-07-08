const express = require('express');
const router = express.Router();
const resultController = require('../controllers/result');


// Fetch class students' results for a particular academic term
router.get('/class_students/:academicTermId/:classSessionId', resultController.classStudentsResults)

module.exports = router;