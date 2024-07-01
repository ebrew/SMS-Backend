const express = require('express');
const router = express.Router();
const academicYearController = require('../controllers/academicYear');

// Create a new academic year
router.post('/create', academicYearController.addAcademicYear);

// Get active academic year
router.get('/get_academic_year/:id', academicYearController.getAcademicYearr);

// Get all academic years
router.get('/all', academicYearController.allAcademicYears);

// update academic year
router.put('/update/:id', academicYearController.updateAcademicYear);

module.exports = router;