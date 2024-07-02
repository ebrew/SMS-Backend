const express = require('express');
const router = express.Router();
const academicTermController = require('../controllers/academicTerm');

// Create a new academic year
router.post('/create', academicTermController.addAcademicTerm);

// update academic term
router.put('/update/:id', academicTermController.updateAcademicTerm);

// Get active academic term
router.get('/active', academicTermController.activeAcademicTerm);

// Get all academic terms
router.get('/all', academicTermController.allAcademicTerms);

// End academic term
router.put('/end/:id', academicTermController.endAcademicTerm);

// Delete academic term
router.delete('/delete/:id', academicTermController.deleteAcademicTerm);


module.exports = router;