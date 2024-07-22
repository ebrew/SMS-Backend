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

// Fetch detailed billing view for admin
router.get('/detailed_billings', billingController.getAdminBillingView)

// Get all fee types with billing details for a specific academic year and term
router.get('/billing_details/all', billingController.getAllFeeTypesWithBillingDetails)

// Update fee type amount from the billing details for all affected students
router.put('/billing_details/fee_type/update_amount', billingController.updateFeeTypeAmountForAllStudents)

module.exports = router;