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

// Get active academic year
router.get('/active', academicYearController.activeAcademicYear);

// End academic year
router.put('/end/:id', academicYearController.endAcademicYear);

// Delete academic year
router.delete('/delete/:id', academicYearController.deleteAcademicYear);

module.exports = router;