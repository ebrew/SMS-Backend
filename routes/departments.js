const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/department');

// Get all departments
router.get('/all', departmentController.allDepartments);

// Create a new department
router.post('/create', departmentController.addDepartment);

// Update an existing department
router.post('/update/:id', departmentController.updateDepartment)

// Delete an existing department
router.get('/delete/:id', departmentController.deleteDepartment)

module.exports = router;