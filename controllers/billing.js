const passport = require('../db/config/passport')
const { Op } = require('sequelize');
const db = require("../db/models/index")
const { validateTermAndYear } = require('../utility/promotion');
const logUserAction = require('../utility/logUserAction');

// Create a new fee type
exports.addFeeType = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' }); 

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
  }) (req, res);
};

// Updating an existing fee type
exports.updateFeeType = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' }); 

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
  })(req, res);
};

// Get all Fee Types for multi selection when billing
exports.allFeeTypes = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' }); 

    try {
      const feeTypes = await db.FeeType.findAll({ order: [['name', 'ASC']] });

      return res.status(200).json({ 'feeTypes': feeTypes });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  }) (req, res);
}

// Delete a Fee Type
exports.deleteFeeType = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' }); 

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
  })(req, res);
};

// Add fee type to billing records or create new records if not found
exports.createOrUpdateBillingRecord = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' }); 

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
  })(req, res);
};

// Fetch class students billing details for a particular academic term or year
exports.classStudentsBillings = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' }); 

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
  })(req, res);
};

// Helper function to calculate total amount owed by a student and check for overpayment
exports.fetchSingleStudentBill = async (studentId) => {

  try {
    const studentIdParsed = parseInt(studentId, 10);

    // Fetch total fees, total payments, and overpaid amounts in one query
    const billingSummary = await db.Billing.findAll({
      where: { studentId: studentIdParsed },
      include: {
        model: db.AcademicTerm,
        where: {
          status: { [Op.notIn]: ['Pending', 'Active'] }
        },
        attributes: [] // Exclude term attributes to optimize query
      },
      attributes: [
        [db.sequelize.fn('SUM', db.sequelize.col('remainingAmount')), 'totalFees'],
        [db.sequelize.fn('SUM', db.sequelize.col('totalPaid')), 'totalPayments'],
        [db.sequelize.fn('SUM', db.sequelize.col('overPaid')), 'totalOverpaid']
      ],
      raw: true
    });

    let totalFees = 0;
    let totalPayments = 0;
    let totalOverpaid = 0;

    if (billingSummary.length > 0) {
      totalFees = parseFloat(billingSummary[0].totalFees) || 0;
      totalPayments = parseFloat(billingSummary[0].totalPayments) || 0;
      totalOverpaid = parseFloat(billingSummary[0].totalOverpaid) || 0;
    }

    // Fetch the current bill for the active academic term
    const currentBill = await db.Billing.findOne({
      where: { studentId: studentIdParsed },
      include: [
        { model: db.AcademicTerm, where: { status: 'Active' } },
        { model: db.AcademicYear, where: { status: 'Active' } },
        {
          model: db.BillingDetail,
          include: {
            model: db.FeeType,
            attributes: ['id', 'name']
          }
        }
      ]
    });

    let billingDetails = [];

    if (currentBill) {
      billingDetails = currentBill.BillingDetails.map(detail => ({
        id: detail.id,
        feeTypeId: detail.FeeType.id,
        name: detail.FeeType.name,
        amount: detail.amount
      }));
      totalOverpaid += currentBill.overPaid;
    }

    // Fetch student's class details for the current academic year
    const studentClass = await db.ClassStudent.findOne({
      where: { studentId: studentIdParsed, academicYearId: currentBill ? currentBill.academicYearId : null },
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

    if (!studentClass) throw new Error('Student class information not found');

    const response = {
      academicYear: currentBill?.AcademicYear?.name || 'N/A',
      academicTerm: currentBill?.AcademicTerm?.name || 'N/A',
      classSession: `${studentClass.Section.Class.name} (${studentClass.Section.name})`,
      studentId: studentClass.Student.id,
      fullName: studentClass.Student.middleName
        ? `${studentClass.Student.firstName} ${studentClass.Student.middleName} ${studentClass.Student.lastName}`
        : `${studentClass.Student.firstName} ${studentClass.Student.lastName}`,
      photo: studentClass.Student.passportPhoto,
      currentBill: billingDetails,
      currentBillTotal: currentBill ? currentBill.totalFees : 0,
      previousOwed: totalFees,
      overPaid: totalOverpaid,
      payable: (currentBill ? currentBill.remainingAmount : 0) + totalFees - totalOverpaid
    };

    return response;
  } catch (error) {
    throw error; // Re-throw the error
  }
};

// Calculate total amount owed by a student and check for overpayment
exports.getSingleStudentTotalAmountOwed = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' }); 

    const studentId = parseInt(req.params.id, 10);

    if (!studentId || studentId <= 0) {
      return res.status(400).json({ message: 'Valid Student ID is required!' });
    }

    try {
      // Fetching the student's bill
      const results = await this.fetchSingleStudentBill(studentId);
      return res.status(200).json(results); 
    } catch (error) {
      if (error.name === 'ValidationError') {
        console.error('Validation Error:', error.message);
        return res.status(400).json({ message: error.message });
      } else {
        console.error('Internal Server Error:', error.message);
        return res.status(500).json({ message: "Can't calculate the total amount owed at the moment!" });
      }
    }
  })(req, res);
};

// Calculate total amount owed by class students and check for overpayment
exports.classStudentsTotalAmountOwed = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' }); 

    try {
      let { classSessionId } = req.params;
      classSessionId = parseInt(classSessionId, 10);

      // Fetch academic year with its active academic term and class section in parallel
      const [year, section] = await Promise.all([
        db.AcademicYear.findOne({
          where: { status: 'Active' },
          include: {
            model: db.AcademicTerm,
            where: { status: 'Active' },
            // attributes: ['name']
          }
        }),
        db.Section.findByPk(classSessionId, {
          include: {
            model: db.Class,
            attributes: ['name'],
          },
        })
      ]);

      if (!section) return res.status(400).json({ message: "Class section not found!" });
      if (!year) return res.status(400).json({ message: "No active academic year found!" });

      const academicYearId = year.id;

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

      // Fetch total fees, total payments, and overpaid amounts for all students in one query
      const billingSummary = await db.Billing.findAll({
        where: { studentId: studentIds },
        include: {
          model: db.AcademicTerm,
          where: {
            status: { [Op.notIn]: ['Pending', 'Active'] }
          },
          attributes: [] // Exclude term attributes to optimize query
        },
        attributes: [
          'studentId',
          [db.sequelize.fn('SUM', db.sequelize.col('remainingAmount')), 'totalFees'],
          [db.sequelize.fn('SUM', db.sequelize.col('totalPaid')), 'totalPayments'],
          [db.sequelize.fn('SUM', db.sequelize.col('overPaid')), 'totalOverpaid']
        ],
        group: ['studentId'],
        raw: true
      });

      // Create maps for quick lookup
      const totalFeesMap = new Map(billingSummary.map(item => [item.studentId, item.totalFees]));
      const totalPaymentsMap = new Map(billingSummary.map(item => [item.studentId, item.totalPayments]));
      const totalOverpaidMap = new Map(billingSummary.map(item => [item.studentId, item.totalOverpaid]));

      const classStudents = [];

      for (const student of students) {
        const studentId = student.Student.id;

        // Fetch the current bill for the active academic term
        const currentBill = await db.Billing.findOne({
          where: { studentId: studentId },
          include: [
            { model: db.AcademicTerm, where: { status: 'Active' } },
            { model: db.AcademicYear, where: { status: 'Active' } },
            {
              model: db.BillingDetail,
              include: {
                model: db.FeeType,
                attributes: ['id', 'name']
              }
            }
          ]
        });

        let billingDetails = [];
        let totalFees = parseFloat(totalFeesMap.get(studentId) || 0);
        let totalPayments = parseFloat(totalPaymentsMap.get(studentId) || 0);
        let totalOverpaid = parseFloat(totalOverpaidMap.get(studentId) || 0);

        if (currentBill) {
          billingDetails = currentBill.BillingDetails.map(detail => ({
            id: detail.id,
            feeTypeId: detail.FeeType.id,
            name: detail.FeeType.name,
            amount: detail.amount
          }));
          totalOverpaid += currentBill.overPaid
        }

        const response = {
          studentId: student.Student.id,
          fullName: student.Student.middleName
            ? `${student.Student.firstName} ${student.Student.middleName} ${student.Student.lastName}`
            : `${student.Student.firstName} ${student.Student.lastName}`,
          photo: student.Student.passportPhoto,
          previousOwed: totalFees,
          overPaid: totalOverpaid,
          currentBill: currentBill ? currentBill.remainingAmount : 0,
          payable: (currentBill ? currentBill.remainingAmount : 0) + totalFees - totalOverpaid
        };

        classStudents.push(response);
      }

      // Sort students based on the amount they owe in descending order
      classStudents.sort((a, b) => b.payable - a.payable);

      const result = {
        academicYear: year.name || 'N/A',
        academicTerm: year.AcademicTerms.length > 0 ? year.AcademicTerms[0].name : 'N/A',
        classSession: `${section.Class.name} (${section.name})`,
        classStudents
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching total amount owed by class students:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  })(req, res);
};

// Process fee payment for a student
exports.processFeePayment = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' }); 

    const { studentId, amount } = req.body;

    if (!studentId || isNaN(studentId) || parseInt(studentId, 10) <= 0) return res.status(400).json({ message: 'Valid Student ID is required!' });
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) return res.status(400).json({ message: 'Valid amount is required!' });

    const transaction = await db.sequelize.transaction();

    try {
      const studentIdParsed = parseInt(studentId, 10);
      const paymentAmount = parseFloat(amount);

      // Check for recent duplicate payments
      const recentPaymentThreshold = 5; // threshold time in minutes
      const recentPayments = await db.Payment.findAll({
        where: {
          studentId: studentIdParsed,
          amount: paymentAmount,
          createdAt: {
            [Op.gte]: db.sequelize.literal(`NOW() - INTERVAL '${recentPaymentThreshold} MINUTE'`)
          }
        },
        transaction
      });

      if (recentPayments.length > 0) {
        return res.status(400).json({ message: `A similar payment was made within the last ${recentPaymentThreshold} minutes. Possible duplicate payment.` });
      }

      // Create a new payment record
      const payment = await db.Payment.create({ studentId: studentIdParsed, amount: paymentAmount }, { transaction });

      // Fetch billing records for the student
      const billingRecords = await db.Billing.findAll({
        where: { studentId: studentIdParsed },
        order: [['id', 'ASC']],
        include: {
          model: db.AcademicTerm,
          where: {
            status: { [Op.notIn]: ['Pending'] }
          },
          attributes: []
        },
        transaction
      });

      if (!billingRecords.length) {
        await transaction.commit();
        return res.status(200).json({ message: 'No billing records found for the student.', payment });
      }

      let remainingAmount = paymentAmount;

      // Create an array to batch update the billing records
      const billingUpdates = billingRecords.map((billing, index) => {
        if (remainingAmount <= 0) return null;

        const billingRemaining = billing.remainingAmount;

        if (billingRemaining > 0) {
          const amountToDeduct = Math.min(remainingAmount, billingRemaining);
          billing.totalPaid += amountToDeduct;
          billing.remainingAmount -= amountToDeduct;
          remainingAmount -= amountToDeduct;

          return billing.save({ transaction });
        }
        return null;
      }).filter(update => update !== null);

      // Handle overpayment
      let overPaidAmount = 0
      if (remainingAmount > 0) {
        const lastBilling = billingRecords[billingRecords.length - 1];
        lastBilling.overPaid += remainingAmount;
        overPaidAmount = lastBilling.overPaid

        billingUpdates.push(lastBilling.save({ transaction }));

        // Set all other billing records' overPaid to 0
        const otherBillings = billingRecords.slice(0, -1).map(billing => {
          billing.overPaid = 0;
          return billing.save({ transaction });
        });
        billingUpdates.push(...otherBillings);
      } else {
        // Set all billing records' overPaid to 0 if no overpayment
        const zeroOverpaidBillings = billingRecords.map(billing => {
          billing.overPaid = 0;
          return billing.save({ transaction });
        });
        billingUpdates.push(...zeroOverpaidBillings);
      }

      // Commit the transaction and wait for all updates to finish
      await Promise.all(billingUpdates);
      await transaction.commit();

      return res.status(200).json({
        message: 'Payment processed successfully!',
        payment,
        overpaidAmount: overPaidAmount
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error('Error processing payment:', error);
      return res.status(500).json({ message: "Can't process payment at the moment!" });
    }
  })(req, res);
};



