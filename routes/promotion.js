const express = require('express');
const router = express.Router();
const promotionController = require('../controllers/promotion');

// Promote all students with pass mark
router.post('/all_students', promotionController.promoteAllStudentsWithPassMark);

// Promote class students without pass mark
router.post('/class', promotionController.promoteClassStudents);

// Repeat students
router.post('/repeat_students', promotionController.repeatClassStudents)

module.exports = router;