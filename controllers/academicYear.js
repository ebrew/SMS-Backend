require('dotenv').config();
const { Op } = require('sequelize');
const passport = require('../db/config/passport')
const { AcademicYear, AcademicTerm, ClassStudent } = require("../db/models/index");

// Get all academic years
exports.allAcademicYears = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });
    try {
      // updating active status if necessary
      let all = await AcademicYear.findOne({ where: { status: 'Active' } });
      if (all)
        await all.setInactiveIfEndDateDue();

      all = await AcademicYear.findAll({
        order: [['createdAt', 'DESC']],
      });

      res.status(200).json({ 'academicYears': all });

    } catch (error) {
      console.error('Error fetching academic year:', error);
      res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Create a new academic year
exports.addAcademicYear = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { name, startDate, endDate } = req.body;

      if (!name || !startDate || !endDate)
        return res.status(400).json({ message: 'Incomplete field!' });

      // Check if an academic year with the same name already exists
      const existingYear = await AcademicYear.findOne({
        where: { name: { [Op.iLike]: name } }
      });

      if (existingYear)
        return res.status(400).json({ message: `${name} already exists!` });

      // Check if there is an active academic year
      let activeYear = await AcademicYear.findOne({ where: { status: 'Active' } });

      if (activeYear) {
        await activeYear.setInactiveIfEndDateDue();
        activeYear = await AcademicYear.findOne({ where: { status: 'Active' } });

        // After updating, if there's still an active year, handle pending year checks
        if (activeYear) {
          let pendingYear = await AcademicYear.findOne({ where: { status: 'Pending' } });
          if (pendingYear) {
            await pendingYear.setInactiveIfEndDateDue();
            pendingYear = await AcademicYear.findOne({ where: { status: 'Pending' } });

            if (pendingYear) {
              return res.status(400).json({ message: 'An academic year with status Pending already exists!' });
            }
          }

          // Ensure the new start date is after the active academic year's end date
          if (new Date(startDate) <= new Date(activeYear.endDate)) {
            return res.status(400).json({ message: 'The start date of the new academic year must be after the end date of the current active academic year.' });
          }

          // Set the new academic year status to 'Pending'
          const status = 'Pending';
          await AcademicYear.create({ name, startDate, endDate, status });

        } else {
          // No active academic year exists, create a new active academic year
          const status = new Date(startDate) > new Date() ? 'Pending' : 'Active';

          // Check for existing academic years and ensure start date is valid
          const latestYear = await AcademicYear.findOne({
            order: [['endDate', 'DESC']],
          });

          if (latestYear && new Date(startDate) <= new Date(latestYear.endDate)) {
            return res.status(400).json({ message: 'The start date of the new academic year must be after the end date of the last academic year.' });
          }

          // Create a new instance of Academic Year
          await AcademicYear.create({ name, startDate, endDate, status });
        }
      } else {
        // No active academic year exists, create a new active academic year
        const status = new Date(startDate) > new Date() ? 'Pending' : 'Active';

        // Check for existing academic years and ensure start date is valid
        const latestYear = await AcademicYear.findOne({
          order: [['endDate', 'DESC']],
        });

        if (latestYear && new Date(startDate) <= new Date(latestYear.endDate)) {
          return res.status(400).json({ message: 'The start date of the new academic year must be after the end date of the last academic year.' });
        }

        // Create a new instance of Academic Year
        await AcademicYear.create({ name, startDate, endDate, status });
      }

      res.status(200).json({ message: 'Academic year created!' });
    } catch (error) {
      console.error('Error creating academic year:', error);
      res.status(500).json({ message: "Can't create academic year at the moment!" });
    }
  });
};

// Update an existing academic year
exports.updateAcademicYear = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { name, startDate, endDate } = req.body;
      const academicYearId = req.params.id;

      if (!name || !startDate || !endDate) return res.status(400).json({ message: 'Incomplete field!' });

      const result = await AcademicYear.findByPk(academicYearId);
      if (!result) return res.status(404).json({ message: 'Academic year not found!' });

      // Ensure the new name is unique
      const alreadyExist = await AcademicYear.findOne({
        where: {
          name: { [Op.iLike]: name },
          id: { [Op.ne]: academicYearId } // Exclude the current academic year
        }
      });

      if (alreadyExist) return res.status(400).json({ message: `${name} already exists!` });

      // Convert dates to Date objects
      const newStartDate = new Date(startDate);
      const newEndDate = new Date(endDate);

      // Check if startDate and endDate of result have not changed
      if (result.startDate.toDateString() === newStartDate.toDateString() && result.endDate.toDateString() === newEndDate.toDateString()) {
        result.name = name;
        await result.save();

        return res.status(200).json({ message: 'Academic year updated successfully!' });
      }

      if (result.status !== 'Active') return res.status(400).json({ message: 'Academic year has already ended!' });

      // Check for existing academic years
      const whereClause = {
        id: { [Op.ne]: academicYearId } // Exclude the current academic year
      };

      if (result.status === 'Active') {
        whereClause.status = { [Op.ne]: 'Pending' }; // Exclude 'Pending' status if current year is 'Active'
      }

      const latestYear = await AcademicYear.findOne({
        where: whereClause,
        order: [['endDate', 'DESC']],
      });

      // Ensure the new startDate is greater than the endDate of the latest academic year
      if (latestYear && newStartDate <= new Date(latestYear.endDate))
        return res.status(400).json({ message: 'The start date of the new academic year must be after the end date of the last academic year.' });

      // Update academic year
      result.name = name;
      result.startDate = newStartDate;
      result.endDate = newEndDate;
      await result.save();

      return res.status(200).json({ message: 'Academic year updated successfully!' });
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ message: 'Cannot update at the moment!' });
    }
  });
};

// Get the active academic year
exports.activeAcademicYear = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      // Find the active academic year and update its status if necessary
      let activeAcademicYear = await AcademicYear.findOne({ where: { status: 'Active' } });
      if (activeAcademicYear)
        await activeAcademicYear.setInactiveIfEndDateDue();
      // Fetch the updated active academic year
      activeAcademicYear = await AcademicYear.findOne({ where: { status: 'Active' } });
      return res.status(200).json({ 'ActiveAcademicYear': activeAcademicYear });
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Get a particular academic year with its terms
exports.getAcademicYear = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const id = req.params.id;

      const academicYear = await AcademicYear.findByPk(id);

      if (!academicYear)
        return res.status(400).json({ message: 'Academic year not found' });

      const academicTerms = await AcademicTerm.findAll({ where: { academicYearId: id } });

      return res.status(200).json({ academicYear, 'academicTerms': academicTerms });
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Delete an academic year
exports.deleteAcademicYear = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const ayId = req.params.id;
      const academicYear = await AcademicYear.findByPk(ayId);

      if (!academicYear) {
        return res.status(400).json({ message: 'Academic year not found!' });
      }

      // Check if academic year has associations
      const hasTerm = await AcademicTerm.findOne({ where: { academicYearId: ayId } });
      const hasStudent = await ClassStudent.findOne({ where: { academicYearId: ayId } });

      if (hasTerm) {
        return res.status(400).json({ message: 'Cannot delete, it has academic term(s) associated with it!' });
      }
      if (hasStudent) {
        return res.status(400).json({ message: 'Cannot delete, it has class students associated with it!' });
      }

      // If no associations, proceed to delete
      await AcademicYear.destroy({ where: { id: ayId } });

      return res.status(200).json({ message: 'Academic year deleted successfully!' });
    } catch (error) {
      console.error('Error deleting academic year:', error);
      return res.status(500).json({ message: 'Cannot delete at the moment' });
    }
  });
};

// End academic year
exports.endAcademicYear = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const ayId = req.params.id;
      const academicYear = await AcademicYear.findByPk(ayId);

      // Check if the academic year exists
      if (!academicYear) return res.status(400).json({ message: 'Academic year not found!' });
      
      // Check if the academic year is pending
      if (academicYear.status === 'Pending') return res.status(400).json({ message: "Academic year hasn't begun!" });

      // Check if the academic year is already inactive
      if (academicYear.status === 'Inactive') return res.status(400).json({ message: 'Academic year has already ended!' });
      
      // Check if the academic year has any active academic terms
      const hasActiveTerm = await AcademicTerm.findOne({ where: { academicYearId: ayId, status: 'Active' }, });
      if (hasActiveTerm) {
        return res.status(400).json({ message: 'Cannot end the academic year, it has active academic terms!' });
      }

      // Set the end date to today's date
      academicYear.endDate = new Date();
      academicYear.status = 'Inactive';

      // Save the updated academic year
      await academicYear.save();
      
      return res.status(200).json({ message: 'Academic year ended successfully!' });
    } catch (error) {
      console.error('Error ending academic year:', error);
      return res.status(500).json({ message: 'Cannot end at the moment' });
    }
  });
};

