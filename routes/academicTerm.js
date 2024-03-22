const express = require('express');
const router = express.Router();
const academicTermController = require('../controllers/academicTerm');

// Create a new academic year
router.post('/create', academicTermController.addAcademicTerm);

// Get active academic term
router.get('/active', academicTermController.activeAcademicTerm);

// Get all academic terms
router.get('/all', academicTermController.allAcademicTerms);


module.exports = router;