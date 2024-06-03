require('dotenv').config();
const { Op, or, and, where } = require('sequelize');
const passport = require('../db/config/passport')
const { ClassSubject, Subject, AssignedSubject, Class } = require("../db/models/index");

// Get all subjects
exports.allSubjects = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const subjects = await Subject.findAll({ order: [['name', 'ASC']] })
      return res.status(200).json({ 'subjects': subjects });
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ Error: "Can't fetch data at the moment!" });
    }
  });
};

// Get all class subjects
exports.allClassSubjects = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const classId = req.params.id;
      let formated = []

      const subjects = await ClassSubject.findAll({ 
        where: { classId },
        include: [
          {
            model: Subject,
            attributes: ['id', 'name'],
            order: [['name', 'ASC']] 
          },
          {
            model: Class,
            attributes: ['id', 'name', 'grade'],
            }
        ],        
      })

      for (const data of subjects) {
        formated.push({
          subjectId: data.Subject.id,
          subjectName: data.Subject.name,
          classId: data.Class.id,
          className: data.Class.name
        });
      }

      return res.status(200).json({ 'ClassSubjects': formated });
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ Error: "Can't fetch data at the moment!" });
    }
  });
};

// Create a new subject
exports.addSubject = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { name, code, description } = req.body;
      console.log('PLS check here: ', req.body)

      if (!name || !code)
        return res.status(400).json({ message: 'Incomplete fields!' });

      const alreadyExist = await Subject.findOne({
        where: {
          [Op.or]: [
            { name: { [Op.iLike]: name } },
            { code: { [Op.iLike]: code } }
          ],
        },
      })

      if (alreadyExist)
        return res.status(400).json({ message: 'Subject already exist!' });

      const savedSubject = await new Subject({ name, code, description }).save()

      if (savedSubject) res.status(200).json({ message: 'Saved successfully!' });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ message: 'Cannot create subject at the moment!' });
    }
  })
};

// Update an existing subject
exports.updateSubject = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const { name, code, description } = req.body;
      const subjectId = req.params.id;

      // Validate request body
      if (!name || !code)
        return res.status(400).json({ message: 'Subject name or code cannot be blank!' });

      // Find the subject by ID
      const subject = await Subject.findByPk(subjectId);

      if (!subject)
        return res.status(404).json({ message: 'Subject not found!' });

      // Update subject attributes
      subject.name = name;
      subject.code = code;
      subject.description = description;

      // Save the updated subject
      await subject.save();

      // Respond with success message
      return res.status(200).json({ message: 'Subject updated successfully!' });
    } catch (error) {
      console.error('Error updating subject:', error);
      return res.status(500).json({ message: 'Unable to update subject at the moment!' });
    }
  });
};

// Delete a subject
exports.deleteSubject = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const subjectId = req.params.id;

      // Check if the subject is assigned to any teachers
      const assignments = await AssignedSubject.findAll({ where: { subjectId } });

      if (assignments.length > 0) {
        return res.status(400).json({ message: 'Cannot delete subject as it is assigned to one or more teachers!' });
      }

      // If no assignments, proceed to delete the subject
      const result = await Subject.destroy({ where: { id: subjectId } });

      if (result === 0) {
        return res.status(400).json({ message: 'Subject not found!' });
      }
      return res.status(200).json({ message: 'Subject deleted successfully!' });
    } catch (error) {
      console.error('Error deleting subject:', error);
      return res.status(500).json({ message: 'Cannot delete subject at the moment' });
    }
  });
};



