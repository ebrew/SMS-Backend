const express = require('express');
const router = express.Router();
const studentController = require('../controllers/student');

// Create a new class with sections
router.post('/new_admission', studentController.admitStudent);

module.exports = router;