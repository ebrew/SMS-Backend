const passport = require('../db/config/passport')
const { validateClassSession, fetchAcademicYears, validateAcademicYears } = require('../utility/promotion');
const db = require("../db/models/index")

// Create a new fee type
exports.addFeeType = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { name, description } = req.body;

      if (!name) return res.status(400).json({ message: 'Fee type name is required!' });

      const alreadyExist = await db.FeeType.findOne({ where: { name: { [Op.iLike]: name } } });

      if (alreadyExist) return res.status(400).json({ message: `${name} fee type already exists!` });

      await db.FeeType.create({ name, description });
      res.status(200).json({ message: 'Fee type created successfully!' });

    } catch (error) {
      console.error('Error creating fee type:', error);
      res.status(500).json({ message: "Can't create fee type at the moment!" });
    }
  });
};

// Updating an existing fee type
exports.updateFeeType = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { name, description } = req.body;
      const id = req.params.id;

      if (!name) return res.status(400).json({ message: 'Fee type name is required!' });

      const feeType = await db.FeeType.findByPk(id);

      if (!feeType) return res.status(404).json({ message: 'Fee type not found!' });

      const alreadyExist = await db.FeeType.findOne({ where: { name: { [Op.iLike]: name }, id: { [Op.ne]: id } } });

      if (alreadyExist) return res.status(400).json({ message: `${name} fee type already exists!` });

      await feeType.update({ name, description });

      res.status(200).json({ message: 'Fee type updated successfully!' });

    } catch (error) {
      console.error('Error updating fee type:', error);
      res.status(500).json({ message: "Can't update fee type at the moment!" });
    }
  });
};

// Get all Fee Types for multi selection when billing
exports.allFeeTypes = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const feeTypes = await db.FeeType.findAll({ order: [['name', 'ASC']] });

      return res.status(200).json({ 'feeTypes': feeTypes });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Delete a Fee Type
exports.deleteFeeType = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const id = req.params.id;

      // Check if the fee type exists
      const feeType = await db.FeeType.findByPk(id);
      if (!feeType) return res.status(404).json({ message: 'Fee type not found!' });
      
      // Check if the fee type is used in any billing records
      const isFeeTypeUsed = await db.BillingDetail.findOne({ where: { feeTypeId: id } });
      if (isFeeTypeUsed) return res.status(400).json({ message: 'Fee type is in use and cannot be deleted!' });
      
      // Delete the fee type
      await feeType.destroy();

      return res.status(200).json({ message: 'Fee type deleted successfully!' });
    } catch (error) {
      console.error('Error deleting fee type:', error);
      return res.status(500).json({ message: "Can't delete fee type at the moment!" });
    }
  });
};

// Add fee type to billing records or create new records if not found
exports.createOrUpdateBillingRecord = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    const { studentIds, academicYearId, academicTermId, feeDetails } = req.body;

    if (!Array.isArray(feeDetails) || feeDetails.length === 0) {
      return res.status(400).json({ message: 'New fee details are required!' });
    }

    const transaction = await db.sequelize.transaction();

    try {
      // Fetch existing billing records for the given students, academic year, and term
      const existingBillingRecords = await db.Billing.findAll({
        where: {
          studentId: studentIds,
          academicYearId,
          termId: academicTermId
        },
        include: [{ model: db.BillingDetail }],
        transaction
      });

      // Create a map to quickly find existing billing records by student ID
      const billingMap = new Map(existingBillingRecords.map(billing => [billing.studentId, billing]));

      // Iterate over each student ID
      for (const studentId of studentIds) {
        let billing = billingMap.get(studentId);

        if (!billing) {
          // Create a new billing record if none exists for this student
          const totalFees = feeDetails.reduce((sum, detail) => sum + detail.amount, 0);
          billing = await db.Billing.create({
            studentId,
            academicYearId,
            termId: academicTermId,
            totalFees,
            totalPaid: 0,
            remainingAmount: totalFees
          }, { transaction });

          billingMap.set(studentId, billing);
        } else {
          // Calculate total amount of new fee details
          const newFeesTotal = feeDetails.reduce((sum, detail) => sum + detail.amount, 0);
          billing.totalFees += newFeesTotal;
          billing.remainingAmount += newFeesTotal;
          await billing.save({ transaction });
        }

        // Iterate over each fee detail
        for (const feeDetail of feeDetails) {
          const existingBillingDetail = billing.BillingDetails.find(
            detail => detail.feeTypeId === feeDetail.feeTypeId
          );

          if (existingBillingDetail) {
            // Update existing fee detail amount
            existingBillingDetail.amount = feeDetail.amount;
            await existingBillingDetail.save({ transaction });
          } else {
            // Create new fee detail
            await db.BillingDetail.create({
              billingId: billing.id,
              feeTypeId: feeDetail.feeTypeId,
              amount: feeDetail.amount
            }, { transaction });
          }
        }
      }

      await transaction.commit();
      res.status(200).json({ billings: [...billingMap.values()] });
    } catch (error) {
      await transaction.rollback();
      console.error('Error adding fee type to billing records:', error);
      res.status(500).json({ message: "Can't add fee type to billing records at the moment!" });
    }
  });
};

// Fetch detailed billing view for admin
exports.getAdminBillingView = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    const { academicYearId, academicTermId } = req.query;

    if (!academicYearId ) {
      return res.status(400).json({ message: 'Academic year ID and term ID are required!' });
    }

    try {
      // Fetch all billing records for the specified academic year and term
      const billings = await db.Billing.findAll({
        where: { academicYearId, termId: academicTermId },
        include: [
          { model: db.BillingDetail },
          {
            model: db.Payment,
            attributes: ['amount'],
            required: false,
            separate: true // To handle payments properly
          }
        ],
        order: [['studentId', 'ASC']]
      });

      // Aggregate billing data
      let totalFeesBilled = 0;
      let totalAmountPaid = 0;
      let totalOutstandingAmount = 0;

      // Calculate totals based on fetched data
      const billingResults = billings.map(billing => {
        const totalPaid = billing.Payments.reduce((sum, payment) => sum + payment.amount, 0);
        const remainingAmount = billing.totalFees - totalPaid;
        
        totalFeesBilled += billing.totalFees;
        totalAmountPaid += totalPaid;
        totalOutstandingAmount += remainingAmount;

        return {
          ...billing.toJSON(),  // Spread all properties of billing instance
          totalPaid,            // Add new property
          remainingAmount       // Add new property
        };
      });

      const response = {
        billings: billingResults,
        totalFeesBilled,
        totalAmountPaid,
        totalOutstandingAmount
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error fetching detailed billing view:', error);
      res.status(500).json({ message: "Can't fetch billing details at the moment!" });
    }
  });
};

// Get all fee types with billing details for a specific academic year and term
exports.getAllFeeTypesWithBillingDetails = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { academicYearId, termId } = req.query;

      if (!academicYearId || !termId) {
        return res.status(400).json({ message: 'Academic year ID and term ID are required!' });
      }

      const feeTypes = await db.FeeType.findAll({
        include: [{
          model: db.BillingDetail,
          attributes: ['amount'],
          include: [{
            model: db.Billing,
            attributes: [],
            where: {
              academicYearId,
              termId
            }
          }]
        }],
        order: [['name', 'ASC']]
      });

      // Summarize billing amounts for each fee type
      const feeTypesWithBillingDetails = feeTypes.map(feeType => {
        const totalBilled = feeType.BillingDetails.reduce((sum, detail) => sum + detail.amount, 0);
        return {
          id: feeType.id,
          name: feeType.name,
          description: feeType.description,
          totalBilled,
        };
      });

      res.status(200).json({ feeTypes: feeTypesWithBillingDetails });
    } catch (error) {
      console.error('Error fetching fee types with billing details:', error);
      res.status(500).json({ message: "Can't fetch fee types at the moment!" });
    }
  });
};

// Update fee type amount from the billing details for all affected students
exports.updateFeeTypeAmountForAllStudents = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    const { academicYearId, academicTermId, feeTypeId, newAmount, studentIds } = req.body;

    if (!academicYearId || !academicTermId || !feeTypeId || newAmount == null || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: 'Academic year ID, term ID, fee type ID, new amount, and student IDs are required!' });
    }

    const transaction = await db.sequelize.transaction();

    try {
      // Fetch all billing details for the given fee type and academic term
      const billingDetails = await db.BillingDetail.findAll({
        where: { feeTypeId },
        include: [
          {
            model: db.Billing,
            where: {
              academicYearId,
              academicTermId,
              studentId: studentIds // Only include the specified students
            }
          }
        ],
        transaction
      });

      // Update each billing detail and recalculate billing totals
      const billingUpdates = billingDetails.map(async (detail) => {
        const oldAmount = detail.amount;

        // Update the billing detail amount
        await detail.update({ amount: newAmount }, { transaction });

        // Recalculate the total fees and remaining amount for the billing record
        const billing = detail.Billing;
        const totalFees = billing.totalFees - oldAmount + newAmount;
        const remainingAmount = billing.remainingAmount - oldAmount + newAmount;

        // Update the billing record
        await billing.update({ totalFees, remainingAmount }, { transaction });

        return billing;
      });

      // Wait for all updates to complete
      const updatedBillings = await Promise.all(billingUpdates);

      await transaction.commit();
      return res.status(200).json({ updatedBillings });
    } catch (error) {
      await transaction.rollback();
      console.error('Error updating fee amounts:', error);
      return res.status(500).json({ message: "Can't update fee amounts at the moment!" });
    }
  });
};









const getFeeSummaryForStudent  = async (studentId, academicYearId, termId) => {
    try {
      const billingRecord = await db.Billing.findOne({
        where: {
          studentId,
          academicYearId,
          termId
        },
        include: [{ model: db.BillingDetail, as: 'billingDetails' }]
      });
  
      if (!billingRecord) {
        throw new Error('No billing record found for the given criteria!');
      }
  
      const totalFees = billingRecord.totalFees;
      const totalPaid = billingRecord.totalPaid;
      const remainingAmount = billingRecord.remainingAmount;
  
      return {
        totalFees,
        totalPaid,
        remainingAmount,
        billingDetails: billingRecord.billingDetails
      };
    } catch (error) {
      throw error;
    }
  };
  

const getFeeSummaryForTerm = async (termId, academicYearId) => {
  try {
    // Fetch all billing records for the specified term and academic year
    const billingRecords = await db.Billing.findAll({
      where: {
        termId,
        academicYearId
      },
      include: [
        {
          model: db.BillingDetail,
          as: 'billingDetails'
        },
        {
          model: db.Student,
          as: 'student'
        }
      ]
    });

    // Process each billing record to compute the fee summary
    const feeSummary = billingRecords.map(billing => {
      const totalFees = billing.totalFees;
      const totalPaid = billing.totalPaid;
      const remainingAmount = billing.remainingAmount;

      return {
        studentId: billing.studentId,
        studentName: `${billing.student.firstName} ${billing.student.lastName}`,
        totalFees,
        totalPaid,
        remainingAmount
      };
    });

    return feeSummary;
  } catch (error) {
    console.error('Error fetching fee summary:', error);
    throw error;
  }
};


// Record a payment
exports.recordPayment = async (req, res) => {
  const { studentId, billingId, amount, paymentDate, paymentMethod } = req.body;

  if (!studentId || !billingId || !amount || !paymentDate) {
    return res.status(400).json({ message: 'Required fields are missing!' });
  }

  const transaction = await db.sequelize.transaction();

  try {
    // Create payment record
    const payment = await db.Payment.create({
      studentId,
      billingId,
      amount,
      paymentDate,
      paymentMethod
    }, { transaction });

    // Update billing record
    const billingRecord = await db.Billing.findByPk(billingId, { transaction });
    if (!billingRecord) {
      throw new Error('Billing record not found!');
    }

    billingRecord.totalPaid += amount;
    billingRecord.remainingAmount = billingRecord.totalFees - billingRecord.totalPaid;

    await billingRecord.save({ transaction });

    // Commit transaction
    await transaction.commit();
    res.status(200).json({ message: 'Payment recorded successfully!', payment });
  } catch (error) {
    // Rollback transaction in case of error
    await transaction.rollback();
    res.status(500).json({ message: 'Error recording payment', error });
  }
};

const processPayment2 = async (invoiceNumber, studentId, amount) => {
  const transaction = await db.sequelize.transaction();

  try {
    // Retrieve the billing record using invoice number and student ID
    const billing = await db.Billing.findOne({
      where: { invoiceNumber, studentId },
      transaction
    });

    if (!billing) {
      throw new Error('Billing record not found!');
    }

    // Update the billing record
    const newTotalPaid = billing.totalPaid + amount;
    const newRemainingAmount = billing.totalFees - newTotalPaid;

    await db.Billing.update({
      totalPaid: newTotalPaid,
      remainingAmount: newRemainingAmount
    }, {
      where: { id: billing.id },
      transaction
    });

    // Create the payment record
    await db.Payment.create({
      billingId: billing.id,
      studentId: billing.studentId,
      amount
    }, { transaction });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};


const getFeeSummaryForStudent2 = async (studentId, academicYearId, termId) => {
  try {
    const billings = await db.Billing.findAll({
      where: {
        studentId,
        academicYearId,
        termId
      },
      include: [db.Payment, db.BillingDetail]
    });

    const totalFees = billings.reduce((sum, billing) => sum + billing.totalFees, 0);
    const totalPaid = billings.reduce((sum, billing) => sum + billing.totalPaid, 0);
    const remainingAmount = totalFees - totalPaid;

    return {
      totalFees,
      totalPaid,
      remainingAmount,
      payments: billings.flatMap(billing => billing.Payments),
      feeDetails: billings.flatMap(billing => billing.BillingDetails)
    };
  } catch (error) {
    throw error;
  }
};

// Get billing and payment summary for a student
exports.getBillingSummary = async (req, res) => {
  const { studentId } = req.params;

  try {
    // Fetch all billing records for the student
    const billings = await db.Billing.findAll({
      where: { studentId },
      include: [{ model: db.Payment }]
    });

    if (!billings.length) {
      return res.status(404).json({ message: 'No billing records found for this student!' });
    }

    let totalFees = 0;
    let totalPaid = 0;
    let remainingAmount = 0;

    // Aggregate fees and payments
    billings.forEach(billing => {
      totalFees += billing.totalFees;
      totalPaid += billing.Payments.reduce((acc, payment) => acc + payment.amount, 0);
      remainingAmount = totalFees - totalPaid;
    });

    res.status(200).json({
      totalFees,
      totalPaid,
      remainingAmount,
      billings
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving billing summary', error });
  }
};









