require('dotenv').config();
const { Op, or, and } = require('sequelize');
const passport = require('../db/config/passport')
const { AcademicYear } = require("../db/models/index");


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

      // updating active status if necessary
      let alreadyExist = await AcademicYear.findOne({ where: { status: 'Active' } });
      if (alreadyExist)
        await alreadyExist.setInactiveIfEndDateDue();

      // Fetch the updated active academic year
      alreadyExist = await AcademicYear.findOne({
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
        return res.status(400).json({ message: `${name} already exist!` });

      // Create a new instance of Academic term
      await AcademicYear.create({ name, startDate, endDate });
      res.status(200).json({ message: 'Academic year created successfully!' });
    } catch (error) {
      console.error('Error creating year:', error);
      res.status(500).json({ message: "Can't create academic year at the moment!" });
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

