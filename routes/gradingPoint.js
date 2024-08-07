const express = require('express');
const router = express.Router();
const gradingSystemController = require('../controllers/gradingSystem');

// Create a new Grading point
router.post('/create', gradingSystemController.addGradePoint);

// Update an already created GradePoint
router.put('/update/:id', gradingSystemController.updateGradePoint)

// Delete Grade Point
router.delete('/delete/:id', gradingSystemController.deleteGradePoint)

// Fetch all GradePoints in descending order of grade
router.get('/all', gradingSystemController.getAllGradePoints);

module.exports = router;