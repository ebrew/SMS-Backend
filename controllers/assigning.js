require('dotenv').config();
const { Op, or, and } = require('sequelize');
const passport = require('../db/config/passport')
const { Class, ClassSubject, Section, Subject, User, AssignedTeacher, AssignedSubject, AcademicTerm } = require("../db/models/index");
const Mail = require('../utility/email');


// Assign a class to a teacher
exports.assignClass = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { teacherId, classSectionId } = req.body;

      if (!teacherId || !classSectionId)
        return res.status(400).json({ message: 'Incomplete field!' });

      if (teacherId === '0' || classSectionId === '0')
        return res.status(400).json({ message: 'You must select the necessary fields!' });

      // Check if the assigned teacher record already exists for this class
      const isExist = await AssignedTeacher.findOne({ where: { teacherId, classId: classSectionId } });

      if (isExist)
        return res.status(400).json({ message: 'Selected class already assigned to the specified teacher!' });

      // Create the Section
      await AssignedTeacher.create({ teacherId, classId: classSectionId });

      res.status(200).json({ message: 'Specified class assigned successfully!' });

    } catch (error) {
      console.error('Error creating class:', error);
      res.status(500).json({ error: "Can't assign the class at the moment!" });
    }
  });
};

// Assign a subject to a teacher
exports.assignSubject = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { assignedTeacherId, subjectId } = req.body;

      if (!assignedTeacherId || !subjectId)
        return res.status(400).json({ message: 'Incomplete field!' });

      if (assignedTeacherId === '0' || subjectId === '0')
        return res.status(400).json({ message: 'You must select the necessary fields!' });

      // Check if the assigned teacher record already exists for this class
      const isExist = await AssignedSubject.findOne({ where: { subjectId, assignedTeacherId } });

      if (isExist)
        return res.status(400).json({ message: 'Selected subject already assigned to the specified teacher!' });

      // Create the subject
      await AssignedSubject.create({ assignedTeacherId, subjectId });

      res.status(200).json({ message: 'Specified subject assigned successfully!' });

    } catch (error) {
      console.error('Error creating class:', error);
      res.status(500).json({ error: "Can't assign the subject at the moment!" });
    }
  });
};

// Deleting an assigned class for a particular teacher
exports.deleteAssignedClass = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const assignedTeacherId = req.params.assignedTeacherId;

      // Check if the subject is assigned to any teacher
      const assignments = await AssignedSubject.findAll({ where: { assignedTeacherId } });

      if (assignments.length > 0) {
        return res.status(400).json({ message: 'Cannot delete assigned class as it is assigned to one or more subject!' });
      }

      // If no assignments, proceed to delete 
      const result = await AssignedTeacher.destroy({ where: { id: assignedTeacherId } });

      if(result === 0)
        return res.status(400).json({ message: 'Assigned class already deleted!' });

      return res.status(200).json({ message: 'Assigned class removed successfully!' });

    } catch (error) {
      if (error.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({ message: 'Cannot delete assigned teacher as it is assigned to one or more subject!' });
      }

      console.error('Error deleting subject:', error);
      return res.status(500).json({ message: 'Cannot assigned class at the moment' });
    }
  });
};

// Deleting an assigned subject for a particular teacher
exports.deleteAssignedSubject = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { assignedTeacherId, subjectId } = req.params;

      const result = await AssignedSubject.destroy({ where: { assignedTeacherId, subjectId } });

      if(result === 0)
        return res.status(400).json({ message: 'Assigned subject already deleted!' });

      return res.status(200).json({ message: 'Assigned subject removed successfully!' });
    } catch (error) {
      console.error('Error deleting subject:', error);
      return res.status(500).json({ message: 'Cannot delete assigned subject at the moment' });
    }
  });
};

// Get a specific teacher's assigned classes and subjects
exports.assignedTeacher = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const teacherId = req.params.id;

      const isExist = await User.findByPk(teacherId);
      if (!isExist)
        return res.status(400).json({ message: `Teacher could not be found!` });

      const activeAssignedTeacher = await AssignedTeacher.findAll({
        where: { teacherId },
        include: [
          {
            model: User,
            attributes: ['id', 'firstName', 'lastName'],
          },
          {
            model: Section,
            attributes: ['id', 'name', 'capacity'],
            include: {
              model: Class,
              attributes: ['id', 'name', 'grade'],
              order: [['grade', 'DESC']],
            }
          }
        ]
      });

      // Map through activeAssignedTeachers and create promises to fetch subjects
      const promises = activeAssignedTeacher.map(async (data) => {
        const assignedSubjects = await AssignedSubject.findAll({
          where: { assignedTeacherId: data.id },
          attributes: [], // not interested in any attributes
          order: [['createdAt', 'DESC']],
          include: {
            model: Subject,
            attributes: ['id', 'name'],
          }
        });

        // Return the formatted data along with the subjects in a class
        return {
          assignedTeacherId: data.id,
          classSection: `${data.Section.Class.name} (${data.Section.name})`,
          subjects: assignedSubjects,
        };
      });

      // Execute all promises concurrently and await their results
      const formattedResult = await Promise.all(promises);

      return res.status(200).json({ "assigned": formattedResult });
    } catch (error) {
      console.error('Error fetching active assigned teachers:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Get all assigned teachers ????
exports.assignedTeachers = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const activeAssignedTeachers = await AssignedTeacher.findAll({
        include: [
          // model: AcademicTerm,
          //   where: { status: 'Active' },
          //   attributes: ['name', 'status'],
          {
            model: User,
            attributes: ['firstName', 'lastName'],
          },
          {
            model: Section,
            attributes: ['id', 'name', 'capacity'],
            include: {
              model: Class,
              attributes: ['id', 'name', 'grade'],
              order: ['grade', 'DESC']
            }
          }
        ],
      });

      // Map through activeAssignedTeachers and create promises to fetch subjects
      const promises = activeAssignedTeachers.map(async (data) => {
        const assignedSubjects = await AssignedSubject.findAll({
          where: { assignedTeacherId: data.id },
          attributes: [], // not inetrested in any attributes
          order: [['createdAt', 'DESC']],
          include: {
            model: Subject,
            attributes: ['id', 'name'],
          }
        });

        // Return the formatted data along with the subjects
        return {
          id: data.id,
          teacherId: data.teacherId,
          classSectionId: data.Section.id,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          teacher: `${data.User.firstName} ${data.User.lastName}`,
          classSection: `${data.Section.Class.name} ${data.Section.name}`,
          capacity: data.Section.capacity,
          grade: data.Section.Class.grade,
          classId: data.Section.Class.id,
          subjects: assignedSubjects,
          classStudents: 'Will add a list of the associated students in this class so you cache them for ur use without reaching the server for only the students.'
        };
      });

      // Execute all promises concurrently and await their results
      const formattedResult = await Promise.all(promises);

      return res.status(200).json({ 'assigned': formattedResult });
    } catch (error) {
      console.error('Error fetching active assigned teachers:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Assign a subject to a class
exports.assignClassSubject = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { classId, subjectId } = req.body;

      if (!classId || !subjectId)
        return res.status(400).json({ message: 'Incomplete field!' });

      // Check if the assigned teacher record already exists for this class
      const isExist = await ClassSubject.findOne({ where: { classId, subjectId } });

      if (isExist)
        return res.status(400).json({ message: 'Subject already assigned to the specified class!' });

      // Create the subject
      await ClassSubject.create({ classId, subjectId });

      res.status(200).json({ message: 'Subject assigned successfully!' });

    } catch (error) {
      console.error('Error creating class:', error);
      res.status(500).json({ error: "Can't assign the subject at the moment!" });
    }
  });
};

// Deleting an assigned subject to class 
exports.deleteAssignedClassSubject = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const {classId, subjectId } = req.params;

      // Check if the subject is assigned to any teachers
      const assignments = await AssignedSubject.findAll({ where: { subjectId } });

      if (assignments.length > 0) {
        return res.status(400).json({ message: 'Cannot delete assigned subject as it is assigned to one or more classes!' });
      }

      // If no assignments, proceed to delete 
      const result = await AssignedTeacher.destroy({ where: { classId, subjectId } });

      if(result === 0)
        return res.status(400).json({ message: 'Assigned subject already deleted!' });

      return res.status(200).json({ message: 'Assigned subject removed successfully!' });
    } catch (error) {
      console.error('Error deleting subject:', error);
      return res.status(500).json({ message: 'Cannot delete at the moment' });
    }
  });
};

