const passport = require('../db/config/passport')
const { Op } = require('sequelize');
const db = require("../db/models/index")
const { validateTermAndYear } = require('../utility/promotion');
const logUserAction = require('../utility/logUserAction');

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
      await logUserAction('User', req.user.id, 'Created a new fee category', `${name} with descrition ${description}`)
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
      const oldName = feeType.name

      await feeType.update({ name, description }, { transaction });
      await logUserAction('User', req.user.id, "Updated a fee category's name", `From ${oldName} to ${name}`)

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
      const name = feeType.name

      // Delete the fee type
      await feeType.destroy();
      await logUserAction('User', req.user.id, 'Deleted a fee category', `${name}`)

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

    let { studentIds, feeDetails, academicYearId, academicTermId } = req.body;

    // Validate input
    if (!Array.isArray(studentIds) || studentIds.length === 0) return res.status(400).json({ message: 'Student IDs are required!' });
    if (!Array.isArray(feeDetails) || feeDetails.length === 0) return res.status(400).json({ message: 'Fee details are required!' });
    if (!academicYearId) return res.status(400).json({ message: 'Academic year ID is required!' });

    // Parse IDs as integers
    studentIds = studentIds.map(id => parseInt(id, 10));
    academicYearId = parseInt(academicYearId, 10);
    academicTermId = academicTermId ? parseInt(academicTermId, 10) : null;

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
      const newBillingDetails = [];
      const updatedBillingDetails = [];
      let newBillingRecordsCreated = false;
      let existingBillingRecordsUpdated = false;

      // Create or update billing records for each student
      for (const studentId of studentIds) {
        let billing = billingMap.get(studentId);

        if (!billing) {
          // Create a new billing record if none exists for this student
          const totalFees = feeDetails.reduce((sum, detail) => sum + parseFloat(detail.amount), 0);
          billing = await db.Billing.create({
            studentId,
            academicYearId,
            academicTermId,
            totalFees,
            totalPaid: 0,
            remainingAmount: totalFees
          }, { transaction });

          // Create billing details for new billing
          for (const feeDetail of feeDetails) {
            newBillingDetails.push({
              billingId: billing.id,
              feeTypeId: parseInt(feeDetail.feeTypeId, 10),
              amount: parseFloat(feeDetail.amount)
            });
          }

          newBillingRecordsCreated = true;
        } else {
          // Update existing billing record
          const existingDetailsMap = new Map((billing.BillingDetails || []).map(detail => [detail.feeTypeId, detail]));

          let updatedTotalFees = 0;

          // Iterate over each fee detail and create or update accordingly
          for (const feeDetail of feeDetails) {
            const feeTypeId = parseInt(feeDetail.feeTypeId, 10);
            const amount = parseFloat(feeDetail.amount);
            const existingBillingDetail = existingDetailsMap.get(feeTypeId);

            if (existingBillingDetail) {
              // Update existing fee detail amount
              existingBillingDetail.amount = amount;
              updatedBillingDetails.push(existingBillingDetail);
            } else {
              // Create new fee detail
              newBillingDetails.push({
                billingId: billing.id,
                feeTypeId,
                amount
              });
            }

            // Accumulate amount for total fees calculation
            updatedTotalFees += amount;
          }

          // Include all existing BillingDetails in the total fees calculation
          for (const existingDetail of billing.BillingDetails) {
            if (!feeDetails.some(feeDetail => parseInt(feeDetail.feeTypeId, 10) === existingDetail.feeTypeId)) {
              updatedTotalFees += existingDetail.amount;
              updatedBillingDetails.push(existingDetail); // Keep existing details
            }
          }

          // Update totalFees and remainingAmount for the billing record
          billing.totalFees = updatedTotalFees;
          billing.remainingAmount = updatedTotalFees - billing.totalPaid;
          await billing.save({ transaction });
          existingBillingRecordsUpdated = true;
        }
      }

      // Perform bulk insert for new billing details
      if (newBillingDetails.length > 0) await db.BillingDetail.bulkCreate(newBillingDetails, { transaction });

      // Perform updates for existing billing details
      if (updatedBillingDetails.length > 0) await Promise.all(updatedBillingDetails.map(detail => detail.save({ transaction })));

      await transaction.commit();

      // Conditional logging
      if (newBillingRecordsCreated) {
        await logUserAction(req.user.role, req.user.id, 'Created billing records', `${JSON.stringify(feeDetails)} was added to ${academicYear.name} ${academicTerm ? academicTerm.name : ''} bills for specified students`);
      }
      if (existingBillingRecordsUpdated) {
        await logUserAction(req.user.role, req.user.id, 'Updated billing records', `${JSON.stringify(feeDetails)} was updated in ${academicYear.name} ${academicTerm ? academicTerm.name : ''} bills for specified students`);
      }

      return res.status(200).json({ message: "Billing record created or updated successfully!" });
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
      let { academicYearId, academicTermId, classSessionId } = req.params;
      
      // Convert academicTermId to null if not provided (for year-based billing)
      academicTermId = academicTermId ? parseInt(academicTermId, 10) : null;
      academicYearId = parseInt(academicYearId, 10);
      classSessionId = parseInt(classSessionId, 10);

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
            Id: detail.id,
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

      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Calculate total amount owed by a student and check for overpayment
exports.getTotalAmountOwed = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    const studentId = req.params.id;

    if (!studentId || isNaN(studentId) || parseInt(studentId, 10) <= 0) {
      return res.status(400).json({ message: 'Valid Student ID is required!' });
    }

    try {
      const studentIdParsed = parseInt(studentId, 10);

      // Fetch total fees from all billing records for the student excluding 'Pending' and 'Active' terms
      const totalFeesResult = await db.Billing.findAll({
        where: { studentId: studentIdParsed },
        include: {
          model: db.AcademicTerm,
          where: {
            status: { [Op.notIn]: ['Pending', 'Active'] }
          },
          attributes: [] // Exclude term attributes to optimize query
        },
        attributes: [
          [db.sequelize.fn('SUM', db.sequelize.col('totalFees')), 'totalFees']
        ],
        raw: true
      });

      // Fetch the current bill for the active academic term
      const currentBill = await db.Billing.findOne({
        where: { studentId: studentIdParsed },
        include: [
          { model: db.AcademicTerm, where: { status: 'Active' } },
          { model: db.AcademicYear },
          {
            model: db.BillingDetail,
            include: {
              model: db.FeeType,
              attributes: ['name']
            }
          }
        ]
      });

      if (!currentBill) {
        return res.status(400).json({ message: 'No bill for the active academic term' });
      }

      // Fetch student's class details for the current academic year
      const studentClass = await db.ClassStudent.findOne({
        where: { studentId: studentIdParsed, academicYearId: currentBill.academicYearId },
        include: [
          {
            model: db.Section,
            attributes: ['name'],
            include: { model: db.Class, attributes: ['name'] }
          },
          {
            model: db.Student,
            attributes: ['id', 'firstName', 'middleName', 'lastName', 'passportPhoto']
          }
        ]
      });

      if (!studentClass) {
        return res.status(400).json({ message: 'Student class information not found' });
      }

      const totalFees = parseFloat(totalFeesResult[0].totalFees) || 0;

      // Fetch total payments made by the student
      const totalPaymentsResult = await db.Payment.findAll({
        where: { studentId: studentIdParsed },
        attributes: [
          [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'totalPayments']
        ],
        raw: true
      });

      const totalPayments = parseFloat(totalPaymentsResult[0].totalPayments) || 0;

      const totalAmountOwed = totalFees - totalPayments;

      const response = {
        academicYear: studentClass.Section.Class.AcademicYear.name,
        academicTerm: studentClass.Section.Class.AcademicTerm.name,
        classSession: `${studentClass.Section.Class.name} (${studentClass.Section.name})`,
        studentId: studentClass.studentId,
        fullName: studentClass.Student.middleName
          ? `${studentClass.Student.firstName} ${studentClass.Student.middleName} ${studentClass.Student.lastName}`
          : `${studentClass.Student.firstName} ${studentClass.Student.lastName}`,
        photo: studentClass.Student.passportPhoto,
        billing: currentBill.BillingDetails,
        totalFees: currentBill.totalFees,
        total: totalFees + totalAmountOwed
      };

      totalAmountOwed > 0 ? response.previousOwed = totalAmountOwed : response.previousBalance = totalAmountOwed;
      return res.status(200).json(response);
    } catch (error) {
      console.error('Error calculating total amount owed:', error);
      return res.status(500).json({ message: "Can't calculate the total amount owed at the moment!" });
    }
  });
};

// Calculate total amount owed by class students and check for overpayment
exports.classStudentsTotalAmountOwed = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    try {
      let { academicYearId, classSessionId } = req.params;

      academicYearId = parseInt(academicYearId, 10);
      classSessionId = parseInt(classSessionId, 10);

      // Fetch academic year and class section
      const year = await db.AcademicYear.findByPk(academicYearId);
      const section = await db.Section.findByPk(classSessionId, {
        include: {
          model: db.Class,
          attributes: ['name'],
        },
      });
      if (!section) return res.status(400).json({ message: "Class section not found!" });
      if (!year) return res.status(400).json({ message: "Academic year not found!" });

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

      // Fetch total fees from all billing records for the students
      const totalFeesResult = await db.Billing.findAll({
        where: { studentId: studentIds },
        attributes: [
          'studentId',
          [db.sequelize.fn('SUM', db.sequelize.col('totalFees')), 'totalFees']
        ],
        group: ['studentId'],
        raw: true
      });

      // Fetch total payments made by the students
      const totalPaymentsResult = await db.Payment.findAll({
        where: { studentId: studentIds },
        attributes: [
          'studentId',
          [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'totalPayments']
        ],
        group: ['studentId'],
        raw: true
      });

      // Create maps for quick lookup
      const totalFeesMap = new Map(totalFeesResult.map(item => [item.studentId, item.totalFees]));
      const totalPaymentsMap = new Map(totalPaymentsResult.map(item => [item.studentId, item.totalPayments]));

      const result = [];

      students.forEach(student => {
        const studentId = student.Student.id;
        const totalFees = parseFloat(totalFeesMap.get(studentId) || 0);
        const totalPayments = parseFloat(totalPaymentsMap.get(studentId) || 0);

        // Calculate total amount owed and determine overpayment
        const isOverpaid = totalPayments > totalFees;
        let totalAmountOwed = 0;
        let overpaidAmount = 0;

        if (isOverpaid) {
          overpaidAmount = totalPayments - totalFees;
        } else {
          totalAmountOwed = totalFees - totalPayments;
        }

        result.push({
          studentId,
          firstName: student.Student.firstName,
          middleName: student.Student.middleName,
          lastName: student.Student.lastName,
          passportPhoto: student.Student.passportPhoto,
          isOverpaid: isOverpaid,
          totalOwed: totalAmountOwed,
          overpaidAmount: overpaidAmount
        });
      });

      // Sort students based on the amount they owe in descending order
      result.sort((a, b) => b.totalOwed - a.totalOwed);

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching total amount owed by class students:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Process fee payment for a student
exports.processFeePayment = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    const { studentId, amount } = req.body;

    if (!studentId || isNaN(studentId) || parseInt(studentId, 10) <= 0) return res.status(400).json({ message: 'Valid Student ID is required!' });
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) return res.status(400).json({ message: 'Valid amount is required!' });

    const transaction = await db.sequelize.transaction();

    try {
      const studentIdParsed = parseInt(studentId, 10);
      const paymentAmount = parseFloat(amount);

      // Create a new payment record
      const payment = await db.Payment.create({ studentId: studentIdParsed, amount: paymentAmount }, { transaction });

      // Fetch billing records for the student
      const billingRecords = await db.Billing.findAll({
        where: { studentId: studentIdParsed },
        order: [['id', 'ASC']], // Ensure consistent ordering
        transaction
      });

      let remainingAmount = paymentAmount;

      for (const billing of billingRecords) {
        if (remainingAmount <= 0) break;

        const billingRemaining = billing.remainingAmount;

        if (billingRemaining > 0) {
          const amountToDeduct = Math.min(remainingAmount, billingRemaining); // how much of the payment should be applied 
          billing.totalPaid += amountToDeduct;
          billing.remainingAmount -= amountToDeduct;
          remainingAmount -= amountToDeduct;

          await billing.save({ transaction });
        }
      }

      // Commit the transaction
      await transaction.commit();

      return res.status(200).json({
        message: 'Payment processed successfully!',
        payment
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error('Error processing payment:', error);
      return res.status(500).json({ message: "Can't process payment at the moment!" });
    }
  });
};
