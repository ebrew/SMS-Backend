const express = require('express');
const router = express.Router();
const subjectController = require('../controllers/subject');

// Get all subjects
router.get('/all', subjectController.allSubjects);

// Fetch class assigned subjects 
router.get('/all_class_subjects/:classId', subjectController.allClassSubjects )

// Create a new class with sections
router.post('/create', subjectController.addSubject);

// Update an existing subject
router.post('/update/:id', subjectController.updateSubject)

// Delete an existing subject
router.get('/delete/:id', subjectController.deleteSubject)

module.exports = router;