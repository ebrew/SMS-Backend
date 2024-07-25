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




// Get all fee types with billing details for a specific academic year and term
router.get('/billing_details/test', billingController.getAdminBillingView)

// Get all fee types with billing details for a specific academic year and term
router.get('/billing_details/all', billingController.getAllFeeTypesWithBillingDetails)

// Update fee type amount from the billing details for all affected students
router.put('/billing_details/fee_type/update_amount', billingController.updateFeeTypeAmountForAllStudents)

// Delete fee type from the billing details for all affected students
router.delete('/billing_details/fee_type/delete', billingController.deleteFeeTypeFromAllStudents)

// Fetch fee summary for all students in a specified academic term and year
router.get('/billing/fee_summary/students', billingController.getFeeSummaryForAllStudents)

// Fetch fee summary for a student term and year
router.get('/billing/fee_summary/student', billingController.getFeeSummaryForStudent)

module.exports = router;