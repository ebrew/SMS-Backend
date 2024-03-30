const express = require('express');
const router = express.Router();
const classController = require('../controllers/class');

// Get all classes
router.get('/all', classController.allClasses);

// Get all class sections for multi select when assigning teachers
router.get('/sections', classController.allClassSections);

// Create a new class with sections
router.post('/create', classController.addClass);

module.exports = router;