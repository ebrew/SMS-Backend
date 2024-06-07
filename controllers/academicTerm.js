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
        return res.status(400).json({ message: `${name} already exist!` });

      const isActive = await AcademicYear.findOne({ where: { id: academicYearId } });

        if (!isActive)
          return res.status(400).json({ message: `Academic year could not be found!` });

        if (isActive && isActive.status === 'Inactive')
          return res.status(400).json({ message: `${isActive.name} has already ended!` });

      // Create a new instance of Academic term
      await AcademicTerm.create({ name, startDate, endDate, academicYearId });
      res.status(200).json({ message: 'Academic term created successfully!' });
    } catch (error) {
      console.error('Error creating term:', error);
      res.status(500).json({ message: "Can't create academic term at the moment!" });
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
