const express = require('express');
const router = express.Router();
const academicYearController = require('../controllers/academicYear');

// Create a new academic year
router.post('/create', academicYearController.addAcademicYear);

// Get active academic year
router.get('/active', academicYearController.activeAcademicYear);

// Get all academic years
router.get('/all', academicYearController.allAcademicYears);

// delete academic year
router.delete('/delete/:id', academicYearController.deleteAcademicYear);

module.exports = router;