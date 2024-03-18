const express = require('express');
const router = express.Router();
const classController = require('../controllers/class');

// Get all classes
router.get('/all', classController.allClasses);

// Create a new class with sections
router.post('/create', classController.addClass);

module.exports = router;