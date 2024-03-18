const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/department');

// Get all departments
router.get('/all', departmentController.allDepartments);

// Create a new department
router.post('/create', departmentController.addDepartment);

module.exports = router;