require('dotenv').config();
const { Op, or, and } = require('sequelize');
const passport = require('../db/config/passport')
const { AcademicTerm, AcademicYear } = require("../db/models/index");


// Get all academic years
exports.allAcademicTerms = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });
    try {
      // updating active status if necessary
      let all = await AcademicTerm.findOne({ where: { status: 'Active' } });
      if (all)
        await all.setInactiveIfEndDateDue();

      all = await AcademicTerm.findAll({
        order: [['createdAt', 'DESC']],
      });

      res.status(200).json({ 'AcademicTerms': all });

    } catch (error) {
      console.error('Error fetching academic year:', error);
      res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Create a new academic term
exports.addAcademicTerm = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { name, startDate, endDate, academicYearId } = req.body;

      if (!name || !startDate || !endDate || !academicYearId)
        return res.status(400).json({ message: 'Incomplete field!' });

      // Check if the academic year exists
      const academicYear = await AcademicYear.findOne({ where: { id: academicYearId } });
      if (!academicYear)
        return res.status(400).json({ message: 'Academic year could not be found!' });

      // Check if the academic year is active
      if (academicYear.status === 'Inactive')
        return res.status(400).json({ message: `${academicYear.name} has already ended!` });

      // Validate the term dates
      const termStartDate = new Date(startDate);
      const termEndDate = new Date(endDate);
      const yearStartDate = new Date(academicYear.startDate);
      const yearEndDate = new Date(academicYear.endDate);

      if (termStartDate < yearStartDate || termEndDate > yearEndDate)
        return res.status(400).json({ message: 'Invalid date range for the specified academic year!' });

      // updating active status if necessary
      let alreadyExist = await AcademicTerm.findOne({ where: { status: 'Active' } });
      if (alreadyExist)
        await alreadyExist.setInactiveIfEndDateDue();

      alreadyExist = await AcademicTerm.findOne({
        where: {
          [Op.or]: [
            { status: 'Active' },
            { name: { [Op.iLike]: name } },
          ],
        },
      });

      if (alreadyExist && alreadyExist.status === 'Active')
        return res.status(400).json({ message: `${alreadyExist.name} is currently running!` });

      if (alreadyExist)
        return res.status(400).json({ message: `${name} already exists!` });

      // Create a new instance of Academic term
      await AcademicTerm.create({ name, startDate, endDate, academicYearId });
      res.status(200).json({ message: 'Academic term created successfully!' });
    } catch (error) {
      console.error('Error creating term:', error);
      res.status(500).json({ message: "Can't create academic term at the moment!" });
    }
  });
};

// Update an existing academic term
exports.updateAcademicTerm = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const academicTermId = req.params.id;
      const { name, startDate, endDate, academicYearId } = req.body;

      if (!name || !startDate || !endDate || !academicYearId)
        return res.status(400).json({ message: 'Incomplete field!' });

      // Check if the academic year exists
      const academicYear = await AcademicYear.findByPk(academicYearId );
      if (!academicYear)
        return res.status(400).json({ message: 'Academic year could not be found!' });

      const result = await AcademicTerm.findByPk(academicTermId);
      if (!result)
        return res.status(400).json({ message: 'Academic term not found!' });

      // Validate the term dates
      const termStartDate = new Date(startDate);
      const termEndDate = new Date(endDate);
      const yearStartDate = new Date(academicYear.startDate);
      const yearEndDate = new Date(academicYear.endDate);

      if (termStartDate < yearStartDate || termEndDate > yearEndDate)
        return res.status(400).json({ message: 'Invalid date range for the specified academic year!' });

      result.name = name;
      result.startDate = startDate;
      result.endDate = endDate
      result.academicYearId = academicYearId
      await result.save();

      return res.status(200).json({ message: 'Academic term updated successfully!' });
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ message: 'Cannot update at the moment!' });
    }
  });
};

// Get the active academic term
exports.activeAcademicTerm = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      // updating active status if necessary
      let activeAcademicTerm = await AcademicTerm.findOne({ where: { status: 'Active' } });
      if (activeAcademicTerm)
        await activeAcademicTerm.setInactiveIfEndDateDue();

      activeAcademicTerm = await AcademicTerm.findOne({ where: { status: 'Active' } });
      return res.status(200).json({ 'ActiveAcademicTerm': activeAcademicTerm });
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};
