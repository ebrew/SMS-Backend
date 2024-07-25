const passport = require('../db/config/passport')
const { Op } = require('sequelize');
const db = require("../db/models/index")
const { validateTermAndYear } = require('../utility/promotion');

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

    const transaction = await db.sequelize.transaction();
    try {
      const { name, description } = req.body;
      const id = req.params.id;

      if (!name) return res.status(400).json({ message: 'Fee type name is required!' });

      const feeType = await db.FeeType.findByPk(id);

      if (!feeType) return res.status(404).json({ message: 'Fee type not found!' });

      // Check if the new name already exists for another fee type
      const alreadyExist = await db.FeeType.findOne({
        where: {
          name: { [Op.iLike]: name },
          id: { [Op.ne]: id }
        },
        transaction
      });

      if (alreadyExist) return res.status(400).json({ message: `${name} fee type already exists!` });

      await feeType.update({ name, description }, { transaction });

      await transaction.commit();
      res.status(200).json({ message: 'Fee type updated successfully!' });

    } catch (error) {
      await transaction.rollback();
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

    const { studentIds, feeDetails, academicYearId, academicTermId } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) return res.status(400).json({ message: 'Student IDs are required!' });
    if (!Array.isArray(feeDetails) || feeDetails.length === 0) return res.status(400).json({ message: 'Fee details are required!' });
    if (!academicYearId) return res.status(400).json({ message: 'Academic year ID is required!' });

    let academicYear, academicTerm;

    try {
      // Validate term and year
      if (!academicTermId) {
        academicYear = await validateTermAndYear(0, academicYearId);
        academicTermId = null;
      } else {
        ({ academicTerm, academicYear } = await validateTermAndYear(academicTermId, academicYearId));
      }
    } catch (validationError) {
      console.error('Validation Error:', validationError.message);
      return res.status(400).json({ message: validationError.message });
    }

    const transaction = await db.sequelize.transaction();

    try {
      // Fetch existing billing records for the given students, academic year, and term
      const existingBillingRecords = await db.Billing.findAll({
        where: {
          studentId: studentIds,
          academicYearId,
          academicTermId
        },
        include: [{ model: db.BillingDetail }],
        transaction
      });

      // Create a map to quickly find existing billing records by student ID
      const billingMap = new Map(existingBillingRecords.map(billing => [billing.studentId, billing]));

      // Data to be used for bulk insert/update
      const newBillings = [];
      const newBillingDetails = [];
      const updatedBillings = [];
      const updatedBillingDetails = [];

      // Create or update billing records for each student
      for (const studentId of studentIds) {
        let billing = billingMap.get(studentId);

        if (!billing) {
          // Create a new billing record if none exists for this student
          const totalFees = feeDetails.reduce((sum, detail) => sum + detail.amount, 0);
          billing = {
            studentId,
            academicYearId,
            academicTermId,
            totalFees,
            totalPaid: 0,
            remainingAmount: totalFees
          };
          newBillings.push(billing);
          billingMap.set(studentId, billing); // Update the map with the new billing
        } else {
          // Update existing billing record
          const existingDetailsMap = new Map((billing.BillingDetails || []).map(detail => [detail.feeTypeId, detail]));

          let updatedTotalFees = 0;

          // Iterate over each fee detail and create or update accordingly
          for (const feeDetail of feeDetails) {
            const existingBillingDetail = existingDetailsMap.get(feeDetail.feeTypeId);

            if (existingBillingDetail) {
              // Update existing fee detail amount
              existingBillingDetail.amount = feeDetail.amount;
              updatedBillingDetails.push(existingBillingDetail);
            } else {
              // Create new fee detail
              newBillingDetails.push({
                billingId: billing.id,
                feeTypeId: feeDetail.feeTypeId,
                amount: feeDetail.amount
              });
            }

            updatedTotalFees += feeDetail.amount;
          }

          billing.totalFees = updatedTotalFees;
          billing.remainingAmount = updatedTotalFees - billing.totalPaid;
          updatedBillings.push(billing);
        }
      }

      // Perform bulk insert for new records
      if (newBillings.length > 0) await db.Billing.bulkCreate(newBillings, { transaction });
      if (newBillingDetails.length > 0) await db.BillingDetail.bulkCreate(newBillingDetails, { transaction });

      // Perform bulk update for existing records
      for (const billing of updatedBillings) await billing.save({ transaction });
      for (const detail of updatedBillingDetails) await detail.save({ transaction });

      await transaction.commit();
      res.status(200).json({ billings: [...billingMap.values()] });
    } catch (error) {
      await transaction.rollback();
      console.error('Error adding fee type to billing records:', error);

      res.status(500).json({ message: "Can't create or update billing records at the moment!" });
    }
  });
};



// Fetch class students billing details for a particular academic term or year
exports.classStudentsBillings = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    try {
      let { academicYearId, academicTermId, classSessionId } = req.body;

      const section = await db.Section.findByPk(classSessionId, {
        include: {
          model: db.Class,
          attributes: ['name'],
        },
      });
      if (!section) return res.status(400).json({ message: "Class section not found!" });

      let academicYear, academicTerm;

      try {
        // Validate term and year
        if (!academicTermId) {
          academicYear = await validateTermAndYear(0, academicYearId);
          academicTermId = null;
        } else {
          ({ academicTerm, academicYear } = await validateTermAndYear(academicTermId, academicYearId));
        }
      } catch (validationError) {
        console.error('Validation Error:', validationError.message);
        return res.status(400).json({ message: validationError.message });
      }

      // Fetching class students
      const students = await db.ClassStudent.findAll({
        where: {
          classSessionId,
          academicYearId
        },
        include: {
          model: db.Student,
          attributes: ['id', 'firstName', 'middleName', 'lastName', 'passportPhoto'],
        }
      });

      const studentIds = students.map(student => student.Student.id);

      // Fetch billings in bulk
      const billings = await db.Billing.findAll({
        where: {
          studentId: studentIds,
          academicYearId,
          academicTermId
        },
        include: {
          model: db.BillingDetail,
          include: {
            model: db.FeeType,
            attributes: ['name']
          }
        }
      });

      // Create a map of billings for quick access
      const billingMap = new Map();
      billings.forEach(billing => {
        if (!billingMap.has(billing.studentId)) {
          billingMap.set(billing.studentId, []);
        }
        billingMap.get(billing.studentId).push({
          billingId: billing.id,
          status: academicTermId ? 'Termly' : 'Yearly',
          totalBill: billing.BillingDetails.reduce((sum, detail) => sum + detail.amount, 0),
          BillingDetails: billing.BillingDetails.map(detail => ({
            feeTypeId: detail.feeTypeId,
            name: detail.FeeType.name,
            amount: detail.amount
          }))
        });
      });

      // Process the students and their billing details
      const classStudents = students.map(student => {
        const studentBillings = billingMap.get(student.Student.id) || [];

        const totalFees = studentBillings.reduce((sum, billing) => sum + billing.totalBill, 0);
        const totalPaid = 0; // Placeholder for total paid amount
        const remainingAmount = totalFees - totalPaid;

        return {
          studentId: student.Student.id,
          fullName: student.Student.middleName
            ? `${student.Student.firstName} ${student.Student.middleName} ${student.Student.lastName}`
            : `${student.Student.firstName} ${student.Student.lastName}`,
          photo: student.Student.passportPhoto,
          billing: studentBillings.length > 0 ? studentBillings[0] : {
            billingId: null,
            status: academicTermId ? 'Termly' : 'Yearly',
            totalBill: 0,
            BillingDetails: []
          },
          oldDebt: 0, // Placeholder for old debt calculation
          totalFees,
          totalPaid,
          remainingAmount,
        };
      });

      const result = {
        academicYear: academicYear.name,
        academicTerm: academicTerm ? academicTerm.name : undefined,
        status: academicTermId ? 'Termly' : 'Yearly',
        classSession: `${section.Class.name} (${section.name})`,
        classStudents
      };

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching students assessments:', error);
      // if (error.message === 'Academic year not found!') {
      //   return res.status(400).json({ message: 'Academic year not found!' });
      // } else if (error.message === 'Academic term not found!') {
      //   return res.status(400).json({ message: 'Academic term not found!' });
      // } else if (error.message === 'Academic term does not belong to the academic year!') {
      //   return res.status(404).json({ message: 'Academic term does not belong to the academic year!' });
      // }
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};







// Fetch detailed billing view for admin
exports.getAdminBillingView = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    const { academicYearId, academicTermId } = req.query;

    if (!academicYearId) {
      return res.status(400).json({ message: 'Academic year ID and term ID are required!' });
    }

    try {
      // Fetch all billing records for the specified academic year and term
      const billings = await db.Billing.findAll({
        where: { academicYearId, academicTermId },
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
      const { academicYearId, academicTermId } = req.query;

      if (!academicYearId || !academicTermId) {
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
              academicTermId
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

// Delete fee type amount from the billing details for all affected students
exports.deleteFeeTypeFromAllStudents = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    const { academicYearId, academicTermId, feeTypeId, studentIds } = req.body;

    if (!academicYearId || !academicTermId || !feeTypeId || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: 'Academic year ID, term ID, fee type ID, and student IDs are required!' });
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

      // Delete each billing detail and recalculate billing totals
      const billingUpdates = billingDetails.map(async (detail) => {
        const amountToRemove = detail.amount;
        const billing = detail.Billing;

        // Delete the billing detail
        await detail.destroy({ transaction });

        // Recalculate the total fees and remaining amount for the billing record
        const totalFees = billing.totalFees - amountToRemove;
        const remainingAmount = billing.remainingAmount - amountToRemove;

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
      console.error('Error deleting fee type from billing records:', error);
      return res.status(500).json({ message: "Can't delete fee type from billing records at the moment!" });
    }
  });
};

// Fetch fee summary for all students in a specified academic term and year
exports.getFeeSummaryForAllStudents = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    const { academicYearId, academicTermId } = req.body;

    if (!academicYearId || !academicTermId) {
      return res.status(400).json({ message: 'Academic year ID and academic term ID are required!' });
    }

    try {
      const billingRecords = await db.Billing.findAll({
        where: {
          academicYearId,
          academicTermId
        },
        include: [
          { model: db.BillingDetail, as: 'billingDetails' },
          {
            model: db.Payment,
            attributes: ['amount'],
            required: false,
            separate: true // To handle payments properly
          }
        ]
      });

      if (!billingRecords || billingRecords.length === 0) {
        return res.status(404).json({ message: 'No billing records found for the given criteria!' });
      }

      const summaries = billingRecords.map(billingRecord => {
        const totalFees = billingRecord.totalFees;
        const totalPaid = billingRecord.Payments.reduce((sum, payment) => sum + payment.amount, 0);
        const remainingAmount = billingRecord.remainingAmount;
        const feeOwed = totalFees - totalPaid;

        return {
          studentId: billingRecord.studentId,
          totalFees,
          totalPaid,
          remainingAmount,
          feeOwed,
          billingDetails: billingRecord.billingDetails
        };
      });

      return res.status(200).json(summaries);
    } catch (error) {
      console.error('Error fetching fee summaries:', error);
      return res.status(500).json({ message: "Can't fetch fee summaries at the moment!" });
    }
  });
};

// Fetch fee summary for a student
exports.getFeeSummaryForStudent = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    const { studentId, academicYearId, academicTermId } = req.body;

    if (!studentId || !academicYearId || !academicTermId) {
      return res.status(400).json({ message: 'Student ID, academic year ID, and academic term ID are required!' });
    }

    try {
      const billingRecord = await db.Billing.findOne({
        where: {
          studentId,
          academicYearId,
          academicTermId
        },
        include: [
          { model: db.BillingDetail, as: 'billingDetails' },
          {
            model: db.Payment,
            attributes: ['amount'],
            required: false,
            separate: true // To handle payments properly
          }
        ]
      });

      if (!billingRecord) {
        return res.status(404).json({ message: 'No billing record found for the given criteria!' });
      }

      const totalFees = billingRecord.totalFees;
      const totalPaid = billingRecord.Payments.reduce((sum, payment) => sum + payment.amount, 0);
      const remainingAmount = billingRecord.remainingAmount;
      const feeOwed = totalFees - totalPaid;

      return res.status(200).json({
        totalFees,
        totalPaid,
        remainingAmount,
        feeOwed,
        billingDetails: billingRecord.billingDetails
      });
    } catch (error) {
      console.error('Error fetching fee summary:', error);
      return res.status(500).json({ message: "Can't fetch fee summary at the moment!" });
    }
  });
};








// method: { type: DataTypes.ENUM('Cash', 'Card', 'Bank Transfer', 'Mobile Money'), defaultValue: 'Cash', allowNull: false },

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










