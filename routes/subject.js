const express = require('express');
const router = express.Router();
const SubjectController = require('../controllers/subject');

// Get all subjects
router.get('/all', SubjectController.allSubjects);

// Create a new class with sections
router.post('/create', SubjectController.addSubject);

module.exports = router;