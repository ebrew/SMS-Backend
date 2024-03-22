require('dotenv').config();
const { Op, or, and } = require('sequelize');
const passport = require('../db/config/passport')
const { Department, User } = require("../db/models/index");

// Get all departments
exports.allDepartments = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const departments = await Department.findAll({
        attributes: ['id', 'name', 'description'],
        order: [['createdAt', 'DESC']],
        include: {
          model: User,
          as: 'hod',
          attributes: ['id', 'firstName', 'lastName'],
        },
      })
      return res.status(200).json({ 'departments': departments });
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ Error: "Can't fetch data at the moment!" });
    }
  });
};

// Create a new department
exports.addDepartment = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { name, description, hodId } = req.body;

      if (!name)
        return res.status(400).json({ message: 'Department name is required!' });

      const alreadyExist = await Department.findOne({ where: { name: { [Op.iLike]: name } } });

      if (alreadyExist)
        return res.status(400).json({ message: 'Department already exit!' });

      if(hodId){  
        const isHODexist = await User.findOne({ where: { id: hodId} });

        if (!isHODexist)
          return res.status(400).json({ message: `Seleected HOD doesn't exist!` });
      }

      const savedDept = await new Department({ name, description, hodId }).save()

      if (savedDept) res.status(200).json({ message: 'Saved successfully!', 'department': savedDept });
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ message: 'Cannot create department at the moment!' });
    }
  })
};




