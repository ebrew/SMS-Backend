const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacher');

// Get all classes
router.get('/all', teacherController.allTeachers);


module.exports = router;