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
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
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

      if(hodId && hodId !== 0){  
        const isHODexist = await User.findByPk(hodId); 

        if (!isHODexist)
          return res.status(400).json({ message: `Seleected HOD doesn't exist!` });
      }

      let savedDept = hodId === 0 ? await new Department({ name, description, hodId: null }).save() : await new Department({ name, description, hodId }).save();

      if (savedDept) res.status(200).json({ message: 'Saved successfully!' });
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ message: 'Cannot create department at the moment!' });
    }
  })
};

// Update an existing department
exports.updateDepartment = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { name, description, hodId } = req.body;
      const departmentId = req.params.id;

      // Parse hodId to integer
      const parsedHodId = parseInt(hodId);

      const department = await Department.findByPk(departmentId); 

      if (!department)
        return res.status(404).json({ message: 'Department not found!' });

      // Ensure hodId is either undefined, null, or a valid integer
      if (hodId && parsedHodId !== 0) {
        if (isNaN(parsedHodId)) 
          return res.status(400).json({ message: 'Invalid HOD ID!' });
        
        const isHodExist = await User.findByPk(parsedHodId);

        if (!isHodExist) 
          return res.status(400).json({ message: 'Selected HOD does not exist!' });
        
        department.hodId = parsedHodId;
      } else {
        department.hodId = null; // If hodId is 0 or undefined, set it to null
      }

      department.name = name;
      department.description = description;
      await department.save(); 

      return res.status(200).json({ message: 'Department updated successfully!'});
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ message: 'Cannot update department at the moment!' });
    }
  });
};

// Delete a department
exports.deleteDepartment = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const departmentId = req.params.id; 

      const department = await Department.findByPk(departmentId); 

      if (!department)
        return res.status(404).json({ message: 'Department not found!' });

      await department.destroy(); 

      return res.status(200).json({ message: 'Department deleted successfully!' });
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ message: 'Cannot delete department at the moment!' });
    }
  });
};