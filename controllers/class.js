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

      console.log('Request body:', req.body);

      if (!className || !grade || !sections)
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
      let isExist;
      if (headTeacherId) {
        isExist = await User.findOne({ where: { id: headTeacherId } });

        if (!isExist)
          return res.status(400).json({ message: `Seleected teacher doesn't exist!` });

        if (isExist && isExist.role !== 'Teacher')
          return res.status(400).json({ message: "Selected staff isn't a teacher" })
      }

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
      const classes = await Class.findAll({ order: [['grade', 'ASC']], include:  { model: User, attributes: ['id', 'firstName', 'lastName'] } });

      // Map through activeAssignedTeachers and create promises to fetch subjects...yet to be executed
      const promises = classes.map(async (data) => {
        const sections = await Section.findAll({
          where: { classId: data.id },
          attributes: ['id', 'name', 'capacity'],  
        });
      
        // Return the formatted data along with the subjects
        return {
          id: data.id,
          name: data.name,
          grade: data.grade,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          headTeacher: data.User ? `${data.User.firstName} ${data.User.lastName}` : null,
          classSections: sections.length,
        };
      });
      
      // Execute all promises concurrently and await their results
      const formattedResult = await Promise.all(promises);

      return res.status(200).json({ 'classes': formattedResult });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Get all Class Sections in different formats
exports.allClassSections = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const classSections = await Section.findAll({
        attributes: ['id', 'name', 'capacity'],
        include: {
          model: Class,
          attributes: ['name'],
          order: [['grade', 'ASC']],
        },
      });

      // Mapping the result to the desired format
      const formattedResult = classSections.map(data => {
        return {
          classSectionId: data.id,
          classSection: `${data.Class.name} ${data.name}`,
          capacity: data.capacity,
        };
      });

      return res.status(200).json({ 'class sections': formattedResult });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};