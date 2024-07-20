const express = require('express');
const router = express.Router();
const promotionController = require('../controllers/promotion');

// Promote class students by head teacher
router.post('/class', promotionController.promoteClassStudents);

// Repeat students by head teacher
router.post('/repeat_students', promotionController.repeatClassStudents)

// Promote class students by Admin (Complexity)
router.post('/class/admin', promotionController.promoteClassStudents);

// Repeat students by Admin (Complexity)
router.post('/repeat_students/admin', promotionController.repeatClassStudents)

module.exports = router;