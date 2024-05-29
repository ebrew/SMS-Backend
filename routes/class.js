const express = require('express');
const router = express.Router();
const classController = require('../controllers/class');

// Get all classes
router.get('/all', classController.allClasses);

// Get a particular class with its sections  
router.get('/get_class/:id', classController.getClassWithSections);

// Get all class sections for multi select when assigning teachers
router.get('/sections', classController.allClassSections);

// Create a new class with sections
router.post('/create', classController.addClass);

// Delete an existing class
router.get('/delete/:id', classController.deleteClass)

// Update an existing class
router.post('/update/:id', classController.updateClass)

// Create a new class section for a particular class
router.post('/create_class_section', classController.addClassSection);

// Updating a class section
router.post('/update_section/:classId/:sectionId', classController.updateClassSection)

// Delete an existing classSection
router.get('/delete_section/:classId/:sectionId', classController.deleteClassSection)

module.exports = router;