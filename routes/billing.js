const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billing');

// Create a new fee type
router.post('/fee_type/create', billingController.addFeeType);

// Update an existing fee type
router.put('/fee_type/update/:id', billingController.updateFeeType)

// Delete a fee type
router.delete('/fee_type/delete/:id', billingController.deleteFeeType);

// Fetch all FeeTypes for Billing multiselection
router.get('/fee_type/all', billingController.allFeeTypes)

// Add fee type to billing records or create new records if not found
router.post('/billing/create_update', billingController.createOrUpdateBillingRecord);

// Fetch class students billing details for a particular academic term 
router.get('/bills/class_students/:academicYearId/:academicTermId/:classSessionId', billingController.classStudentsBillings);

// Fetch class students billing details for a particular academic year
router.get('/bills/class_students/:academicYearId/:classSessionId', billingController.classStudentsBillings);

// Calculate total amount owed by a student and check for overpayment
router.get('/billings/student/owed/:id', billingController.getTotalAmountOwed)

// Calculate total amount owed by class students and check for overpayment
router.get('/billings/students/owed/:academicYearId/:classSessionId', billingController.classStudentsTotalAmountOwed)

// Process fee payment for a student
router.post('/payments/student/process', billingController.processFeePayment);


module.exports = router;