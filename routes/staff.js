const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staff');

// Login
router.post('/login', staffController.login);

// Staff Registration
router.post('/register', staffController.register);

// Fetch student or staff details
router.get('/details/:id/:role', staffController.getUser)

// Update an existing staff
router.post('/update/:id', staffController.updateStaff)

// Delete an existing staff
router.get('/delete/:id', staffController.deleteStaff)

// Reset staff account DEFAULT PASSWORD after account creation
router.post('/default-reset', staffController.defaultReset);

// Request Password Reset from Admin
router.post('/password-reset-request', staffController.passwordResetRequest)

// Admin resetting password with email link request or from Admin requests' list
router.get('/admin-reset-password/:token', staffController.adminResetPassword) 

// List of pending Password reset requests
router.get('/pending-password-reset-requests', staffController.pendingResetRequest)

// Get all staff
router.get('/all', staffController.allStaff)

// Developer registering admin
router.post('/dev', staffController.devAddAdmin);


// // Forgot Password
// router.post('/forgot-password', Mail.forgotPassword);

// // Reset Password
// router.post('/reset-password/:token', Mail.resetPassword);

module.exports = router;
