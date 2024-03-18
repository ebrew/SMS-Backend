require('dotenv').config();
const { Op, or, and } = require('sequelize');
const passport = require('../db/config/passport')
const { Class, Section, User } = require("../db/models/index");

// Create a new class with sections
exports.addClass = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { className, grade, headTeacherId, sections } = req.body;

      if (!className || !grade || !headTeacherId || !sections)
        return res.status(400).json({ message: 'Incomplete field!' });

      const alreadyExist = await Class.findOne({
        where: {
          [Op.or]: [
            { name: { [Op.iLike]: className } },
            { grade: grade },
          ],
        },
      });

      if (alreadyExist)
        return res.status(400).json({ message: `${className} or grade ${grade} already exists!` });

      // Validating section data before creating the class
      for (const sectionData of sections) {
        const { name, capacity } = sectionData;
        if (!name || !capacity)
          return res.status(400).json({ message: 'Invalid section data' });
      }

      // // Validate that headTeacherId exists in the Users table
      // const headTeacherExists = await User.findOne({
      //   where: { id: headTeacherId }
      // });

      // if (!headTeacherExists) {
      //   return res.status(400).json({ message: 'Invalid headTeacherId' });
      // }

      // Create the Class
      const newClass = await Class.create({
        name: className,
        grade: grade,
        headTeacherId: headTeacherId,
      });

      const classId = newClass.id;

      // Save the Sections
      for (const sectionData of sections) {
        try {
          const { name, capacity } = sectionData;

          // Create the Section
          await Section.create({
            name: name,
            capacity: capacity,
            classId: classId,
          });
        } catch (error) {
          console.error('Error creating section:', error.message);
          // future error handling in the fure
        }
      }
      res.status(200).json({ message: 'Class and sections created successfully!' });

    } catch (error) {
      console.error('Error creating class and sections:', error);
      res.status(500).json({ error: "Can't create class at the moment!" });
    }
  });
};

// Get all Classes
exports.allClasses = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const classes = await Section.findAll({
        attributes: ['id', 'name', 'capacity'],
        // order: [['name', 'ASC']],
        include: {
          model: Class,
          attributes: ['id', 'name', 'grade'],
          include: {
            model: User,
            attributes: ['id', 'firstName', 'lastName'],
          },
        },
      })
      return res.status(200).json({ 'classes': classes });
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ Error: "Can't fetch data at the moment!" });
    }
  });
};
