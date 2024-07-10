const express = require('express');
const router = express.Router();
const promotionController = require('../controllers/promotionController');

router.post('/promote/all', promotionController.promoteAllStudents);

router.post('/promote/class', promotionController.promoteClassStudents);

router.post('/promote/student', promotionController.promoteSingleStudent);

module.exports = router;



module.exports = router;