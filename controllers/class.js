require('dotenv').config();
const { Op, or, and, where } = require('sequelize');
const passport = require('../db/config/passport')
const { Class, ClassSubject, Subject, Section, User, AssignedTeacher } = require("../db/models/index");

// Create a new class with sections
exports.addClass = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { className, grade, headTeacherId, sections } = req.body;

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
      if (headTeacherId && headTeacherId !== '0') {
        isExist = await User.findByPk(headTeacherId);

        if (!isExist)
          return res.status(400).json({ message: `Seleected teacher doesn't exist!` });

        if (isExist && isExist.role !== 'Teacher')
          return res.status(400).json({ message: "Selected staff isn't a teacher" })
      }

      // Create the Class
      let newClass = headTeacherId === '0' ? await Class.create({ name: className, grade, headTeacherId: null }) : await Class.create({ name: className, grade, headTeacherId });

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

// Add a class section to a class
exports.addClassSection = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { classId, name, capacity } = req.body;

      if (!classId || !name || !capacity)
        return res.status(400).json({ message: 'Incomplete field!' });

      // Check if the section already exists for this class
      const isExist = await Section.findOne({
        where: {
            name: { [Op.iLike]: name },
            capacity ,
            classId
        },
      });

      if (isExist)
        return res.status(400).json({ message: 'Section already created for the specified class!' });

      // Create the Section
      await Section.create({ classId, name, capacity });

      res.status(200).json({ message: 'Section created successfully!' });

    } catch (error) {
      console.error('Error creating class:', error);
      res.status(500).json({ error: "Can't create class section at the moment!" });
    }
  });
};

// Update an existing class section
exports.updateClassSection = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { name, capacity } = req.body;
      const { classId, sectionId } = req.params;

      if (!name || !capacity)
        return res.status(400).json({ message: 'Incomplete fields!' });

      const result = await Section.findOne({ where: { classId, id: sectionId } });

      if (!result)
        return res.status(404).json({ message: 'Section not found!' });

      result.name = name;
      result.capacity = capacity;
      await result.save();

      return res.status(200).json({ message: 'Class section updated successfully!' });
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ message: 'Cannot update class section at the moment!' });
    }
  });
};

// Deleting a class section 
exports.deleteClassSection = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { classId, sectionId } = req.params;

      // Check if the section is assigned to any teachers
      const assignments = await AssignedTeacher.findAll({ where: { classId: sectionId } });

      if (assignments.length > 0) {
        return res.status(400).json({ message: 'Cannot delete class section as it is assigned to one or more teachers!' });
      }
      const result = await Section.destroy({ where: { classId, id: sectionId } });

      if (result === 0) {
        return res.status(404).json({ message: 'Class section already deleted!' });
      }
      return res.status(200).json({ message: 'Class section deleted successfully!' });
    } catch (error) {
      console.error('Error deleting subject:', error);
      return res.status(500).json({ message: 'Cannot delete at the moment' });
    }
  });
};

// Get all Classes
exports.allClasses = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const classes = await Class.findAll({ order: [['grade', 'ASC']], include: { model: User, attributes: ['id', 'firstName', 'lastName'] } });

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

// Get a particular class with its sections for teacher assignment   
exports.getClassWithSections = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const classId = req.params.id;

      const data = await Class.findOne({
        where: { id: classId },
        include: { model: User, attributes: ['id', 'firstName', 'lastName'] },
      });

      if (!data) {
        return res.status(404).json({ message: 'Class not found!' });
      }

      const sections = await Section.findAll({
        where: { classId },
        attributes: ['id', 'name', 'capacity'],
        order: [['name', 'ASC']],
      });

      const subject = await ClassSubject.findAll({
        where: { classId },
        include: { model: Subject, attributes: ['id', 'name', 'code'] }
      });

      let subjects = []
      for (const data of subject) {
        subjects.push( data.Subject );
      }

      // Return the formatted data 
      const formattedResult = {
        id: data.id,
        name: data.name,
        grade: data.grade,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        headTeacher: data.User ? `${data.User.firstName} ${data.User.lastName}` : null,
        classSections: sections,
        classSubjects: subjects
      };

      return res.status(200).json({ 'class': formattedResult });
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
          class: `${data.Class.name}`,
          classSection: `${data.name}`,
          capacity: data.capacity,
        };
      });

      return res.status(200).json({ 'classSections': formattedResult });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Update an existing class
exports.updateClass = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { className, grade, headTeacherId } = req.body;
      const classId = req.params.id;

      if (!className || !grade)
        return res.status(400).json({ message: 'Class name or grade cannot be blank!' });

      const name = await Class.findByPk(classId);

      if (!name)
        return res.status(404).json({ message: 'Class not found!' });

      if (headTeacherId && headTeacherId !== 0) {
        const isHodExist = await User.findByPk(headTeacherId);

        if (!isHodExist)
          return res.status(400).json({ message: `Selected Teacher doesn't exist!` });
      }

      // const alreadyExist = await Class.findOne({ where: { name: className } });
      // if (alreadyExist)
      //   return res.status(400).json({ message: `${className} already exist!` });

      // Update department attributes
      name.name = className;
      name.grade = grade;
      name.headTeacherId = headTeacherId;

      await name.save();

      return res.status(200).json({ message: 'Class updated successfully!' });
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ message: 'Cannot update class at the moment!' });
    }
  });
};

// Deleting a class
exports.deleteClass = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const classId = req.params.id;
      let used = false

      const subjectChecks = await ClassSubject.findOne({ where: { classId} });
      if (subjectChecks) 
        return res.status(400).json({ message: 'Cannot delete class as one or more subjects been assigned to it!' });

      // Check if a class is assigned to a teacher   
      const checks = await Section.findAll({ where: { classId } });
      for (const data of checks) {
        const check = await AssignedTeacher.findOne({ where: { classId: data.id } });
        if (check) {
          used = true;
          break; 
        }
      }

      if (used) 
        return res.status(400).json({ message: 'Cannot delete class as one or more of its sections been assigned to one or more teachers!' });
      
      // If no assignments, proceed to delete 
      const result = await Class.destroy({ where: { id: classId} });

      if (result === 0) {
        return res.status(404).json({ message: 'Class not found!' });
      }
      return res.status(200).json({ message: 'Class deleted successfully!' });
    } catch (error) {
      console.error('Error deleting class:', error);
      return res.status(500).json({ message: 'Cannot delete class at the moment' });
    }
  });
};
