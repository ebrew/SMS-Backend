require('dotenv').config();
const { Op } = require('sequelize');
const passport = require('../db/config/passport')
const { AcademicTerm, AcademicYear, Assessment } = require("../db/models/index");


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
exports.addAcademicTermOld = async (req, res) => {
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

      // Validate the term dates fall within year date
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

      // Check for existing academic terms
      const latestTerm = await AcademicTerm.findOne({
        order: [['endDate', 'DESC']],
      });

      // Ensure the new startDate is greater than the endDate of the latest academic term
      if (latestTerm && new Date(startDate) < new Date(latestTerm.endDate))
        return res.status(400).json({ message: 'The start date of the new academic term must be after the end date of the last academic term.' });

      // Create a new instance of Academic term
      await AcademicTerm.create({ name, startDate, endDate, academicYearId });
      res.status(200).json({ message: 'Academic term created successfully!' });
    } catch (error) {
      console.error('Error creating term:', error);
      res.status(500).json({ message: "Can't create academic term at the moment!" });
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

      // Validate the term dates fall within year date
      const termStartDate = new Date(startDate);
      const termEndDate = new Date(endDate);
      const yearStartDate = new Date(academicYear.startDate);
      const yearEndDate = new Date(academicYear.endDate);

      if (termStartDate < yearStartDate || termEndDate > yearEndDate)
        return res.status(400).json({ message: 'Invalid date range for the specified academic year!' });

      // Check if the term name already exists within the academic year
      const termExists = await AcademicTerm.findOne({
        where: {
          name: { [Op.iLike]: name },
          academicYearId: academicYearId,
        },
      });

      if (termExists)
        return res.status(400).json({ message: `The term name "${name}" already exists for this academic year!` });

      // Check for overlapping terms within the academic year
      const overlappingTerm = await AcademicTerm.findOne({
        where: {
          academicYearId: academicYearId,
          [Op.or]: [
            { startDate: { [Op.between]: [termStartDate, termEndDate] } },
            { endDate: { [Op.between]: [termStartDate, termEndDate] } },
            { [Op.and]: [{ startDate: { [Op.lte]: termStartDate } }, { endDate: { [Op.gte]: termEndDate } }] }
          ],
        },
      });

      if (overlappingTerm)
        return res.status(400).json({ message: 'The term dates overlap with an existing term in the academic year!' });

      // updating active status if necessary
      let alreadyExist = await AcademicTerm.findOne({ where: { status: 'Active' } });
      if (alreadyExist)
        await alreadyExist.setInactiveIfEndDateDue();

      // Ensure the new startDate is greater than the endDate of the latest academic term
      const latestTerm = await AcademicTerm.findOne({
        order: [['endDate', 'DESC']],
      });

      if (latestTerm && termStartDate < new Date(latestTerm.endDate))
        return res.status(400).json({ message: 'The start date of the new academic term must be after the end date of the last academic term.' });

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
      const { name, startDate, endDate } = req.body;

      if (!name || !startDate || !endDate)
        return res.status(400).json({ message: 'Incomplete field!' });

      const result = await AcademicTerm.findByPk(academicTermId, { include: { model: AcademicYear }});

      if (!result)
        return res.status(400).json({ message: 'Academic term not found!' });

      // Convert dates to Date objects
      const termStartDate = new Date(startDate);
      const termEndDate = new Date(endDate);
      const yearStartDate = new Date(result.AcademicYear.startDate);
      const yearEndDate = new Date(result.AcademicYear.endDate);

      // Check if startDate and endDate of result have not changed
      if (result.startDate.toDateString() === termStartDate.toDateString() && result.endDate.toDateString() === termEndDate.toDateString()) {
        result.name = name;
        await result.save();

        return res.status(200).json({ message: 'Academic term updated successfully!' });
      }

      // Validate the term dates against its academic year date
      if (termStartDate < yearStartDate || termEndDate > yearEndDate)
        return res.status(400).json({ message: "Invalid date range for term's academic year!" });

      if (result.status !== 'Active')
        return res.status(400).json({ message: 'Academic term has already ended!' });

      // Check for existing academic terms
      const latestTerm = await AcademicTerm.findOne({
        where: {
          id: { [Op.ne]: academicTermId }, // Exclude the current academic term
        },
        order: [['endDate', 'DESC']],
      });

      // Ensure the new startDate is greater than the endDate of the latest academic term
      if (latestTerm && termStartDate < new Date(latestTerm.endDate))
        return res.status(400).json({ message: 'The start date of the new academic term must be after the end date of the last academic term!' });

      // Update academic term
      result.name = name;
      result.startDate = termStartDate;
      result.endDate = termEndDate;
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

// Delete an academic term
exports.deleteAcademicTerm = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const id = req.params.id;
      const academicTerm = await AcademicTerm.findByPk(id);

      if (!academicTerm) {
        return res.status(400).json({ message: 'Academic term not found!' });
      }

      // Check if academic term has associations
      const hasAssessment = await Assessment.findOne({ where: { academicTermId: id } });

      if (hasAssessment) {
        return res.status(400).json({ message: 'Cannot delete, it has academic assessment(s) associated with it!' });
      }

      // If no associations, proceed to delete
      await AcademicTerm.destroy({ where: { id } });

      return res.status(200).json({ message: 'Academic term deleted successfully!' });
    } catch (error) {
      console.error('Error deleting academic term:', error);
      return res.status(500).json({ message: 'Cannot delete at the moment' });
    }
  });
};

// End academic term
exports.endAcademicTerm = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const id = req.params.id;
      const academicTerm = await AcademicTerm.findByPk(id);

      // Check if the academic term exists
      if (!academicTerm) {
        return res.status(400).json({ message: 'Academic term not found!' });
      }

      // Check if the academic term is already inactive
      if (academicTerm.status === 'Inactive') {
        return res.status(400).json({ message: 'Academic term has already ended!' });
      }

      // Set the end date to today's date
      academicTerm.endDate = new Date();
      academicTerm.status = 'Inactive';

      // Save the updated academic term
      await academicTerm.save();

      return res.status(200).json({ message: 'Academic term ended successfully!' });
    } catch (error) {
      console.error('Error ending academic term:', error);
      return res.status(500).json({ message: 'Cannot end at the moment' });
    }
  });
};

