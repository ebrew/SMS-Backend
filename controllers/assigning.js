require('dotenv').config();
const { Op, or, and } = require('sequelize');
const passport = require('../db/config/passport')
const { Class, Section, Subject, User, AssignedTeacher, AssignedSubject, AcademicTerm } = require("../db/models/index");
const Mail = require('../utility/email');

// Assign classes and subjects to teachers (one time)
exports.assignClassesAndSubjects = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { teacherId, classes, subjects } = req.body;
      let userInfo = [];
      let classList = []
      let subjectList = []

      // Validate the request body
      if (!teacherId || !Array.isArray(classes) || !Array.isArray(subjects))
        return res.status(400).json({ message: 'Invalid request body!' });

      // Verifying foreign keys
      const isExist = await User.findOne({ where: { id: teacherId } });

      if (!isExist || isExist.role !== 'Teacher')
        return res.status(400).json({ message: `Selected teacher doesn't exist or isn't a teacher` });

      // Validating classes and subjects existence before assigning to teacher
      for (const data of classes) {
        const { classId } = data;

        // Check if the assigned teacher record already exists for this class
        let existingTeacher = await AssignedTeacher.findOne({ where: { teacherId, classId } });

        // If not, create a new assigned teacher record
        if (!existingTeacher)
          existingTeacher = await AssignedTeacher.create({ teacherId, classId });
          const newClass = await Section.findOne({
            where: { id: classId },
            include: { model: Class, attributes: ['name'] }
          });

          const combinedClassName = `${newClass.Class.name} - ${newClass.name}`;
          classList.push(combinedClassName)

        const assignedId = existingTeacher.id;

        // Loop through the subjects list
        for (const subjectData of subjects) {
          const { subjectId } = subjectData;

          // Check if the assigned subject record already exists for this subject
          const existingSubject = await AssignedSubject.findOne({ where: { subjectId, assignedTeacherId: assignedId } });

          if (existingSubject) {
            const subjectName = (await Subject.findOne({ where: { id: subjectId } })).name;
            const className = (await Section.findOne({ where: { id: classId } })).name;
            userInfo.push(`${subjectName} has already been assigned to the selected teacher in class ${className}`);
          } else {
            // If not, create a new assigned subject record
            await AssignedSubject.create({ assignedTeacherId: assignedId, subjectId });
            const newSubject = await Subject.findOne({ where: { id: classId } }).name
            newSubject.push(newSubject)
          }
        }
      }

      // Email prompt to the teacher
      const needed = (classList.length === 0 && subjectList.length === 0) ? false : true;
      if (needed === true) {
        const message = classList.length === 0 ? `You have been assigned to the following subjects in your already assigned class(s): ${subjectList.join(', ')}` : `You have been assigned to the following classes: ${classList.join(', ')} with the following subjects: ${subjectList.join(', ')}`;
        const salutation = isExist.gender === 'Male' ? `Hello Sir ${isExist.firstName},` : `Hello Madam ${isExist.firstName},`;
        await Mail.classAssignmentPromptEmail(isExist.email, salutation, message);
      }

      const msg = 'Assignment executed successfully!';
      const note = userInfo.length > 0 ? `Take note of the following: ${userInfo.join(', ')}` : '';
      res.status(200).json({ message: `${msg}. ${note}` });

    } catch (error) {
      console.error('Error assigning classes and subjects:', error);
      res.status(500).json({ message: "Can't assign classes and subjects at the moment!" });
    }
  });
};

// Get all assigned teachers
exports.assignedTeachers = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const activeAssignedTeachers = await AssignedTeacher.findAll({
        include: [
          {
            model: User,
            attributes: ['firstName', 'lastName'],
          },
          {
            model: Section,
            attributes: ['name', 'capacity'],
            include: {
              model: Class,
              attributes: ['name', 'grade'],
              order: ['grade', 'DESC']
            }
          }
        ]
      });

      return res.status(200).json({ 'all active assigned teachers': activeAssignedTeachers });
    } catch (error) {
      console.error('Error fetching active assigned teachers:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Get a teacher's assigned classes
exports.assignedTeacher = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const teacherId = req.params.id;

      const isExist = await User.findOne({ where: { id: teacherId } });
      if (!isExist)
        return res.status(400).json({ message: `Teacher could not be found!` });

      const activeAssignedTeachers = await AssignedTeacher.findAll({
        where: { teacherId: teacherId },
        include: [
          {
            model: User,
            attributes: ['firstName', 'lastName'],
          },
          {
            model: Section,
            attributes: ['name', 'capacity'],
            include: {
              model: Class,
              attributes: ['name', 'grade'],
              order: [['grade', 'DESC']],
            }
          }
        ]
      });

      return res.status(200).json({ "teacher's active assigned classes": activeAssignedTeachers });
    } catch (error) {
      console.error('Error fetching active assigned teachers:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Assign classes and subjects to teachers termly
exports.assignClassesAndSubjectsTermly = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { teacherId, academicTermId, classes, subjects } = req.body;
      let userInfo = [];

      // Validate the request body
      if (!teacherId || !academicTermId || !Array.isArray(classes) || !Array.isArray(subjects))
        return res.status(400).json({ message: 'Invalid request body!' });

      // Verifying foreign keys
      const isActive = await AcademicTerm.findOne({ where: { id: academicTermId } });
      const isExist = await User.findOne({ where: { id: teacherId } });

      if (!isActive)
        return res.status(400).json({ message: `Academic term could not be found!` });

      if (isActive.status === 'Inactive')
        return res.status(400).json({ message: `${isActive.name} has already ended!` });

      if (!isExist || isExist.role !== 'Teacher')
        return res.status(400).json({ message: `Selected teacher doesn't exist or isn't a teacher` });

      // Validating classes and subjects existence before assigning to teacher
      for (const data of classes) {
        const { classId } = data;

        // Check if the assigned teacher record already exists for this class
        let existingTeacher = await AssignedTeacher.findOne({ where: { teacherId, academicTermId, classId } });

        // If not, create a new assigned teacher record
        if (!existingTeacher)
          existingTeacher = await AssignedTeacher.create({ teacherId, academicTermId, classId });

        const assignedId = existingTeacher.id; // Store the assigned teacher ID

        // Loop through the subjects list
        for (const subjectData of subjects) {
          const { subjectId } = subjectData;

          // Check if the assigned subject record already exists for this subject
          const existingSubject = await AssignedSubject.findOne({ where: { subjectId, assignedTeacherId: assignedId } });

          if (existingSubject) {
            const subjectName = (await Subject.findOne({ where: { id: subjectId } })).name;
            const className = (await Section.findOne({ where: { id: classId } })).name;
            userInfo.push(`${subjectName} has already been assigned to the selected teacher in class ${className}`);
          } else {
            // If not, create a new assigned subject record
            try {
              await AssignedSubject.create({ assignedTeacherId: assignedId, subjectId: subjectId });
            } catch (error) {
              console.error('Error creating assigned subject:', error);
            }
          }
        }
      }

      const message = 'Assignment executed successfully!';
      const note = userInfo.length > 0 ? `Take note of the following: ${userInfo.join(', ')}` : '';

      res.status(200).json({ message: `${message}. ${note}` });

    } catch (error) {
      console.error('Error assigning classes and subjects:', error);
      res.status(500).json({ message: "Can't assign classes and subjects at the moment!" });
    }
  });
};

// Get all assigned teachers for active term
exports.activeAssignedTeachers = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const activeAssignedTeachers = await AssignedTeacher.findAll({
        include: [
          {
            model: AcademicTerm,
            where: { status: 'Active' },
            attributes: ['name', 'status'],
          },
          {
            model: User,
            attributes: ['firstName', 'lastName'],
          },
          {
            model: Section,
            attributes: ['name', 'capacity'],
            include: {
              model: Class,
              attributes: ['name', 'grade'],
              order: ['grade', 'DESC']
            }
          }
        ]
      });

      // // Map the result to the desired format
      // const formattedResult = activeAssignedTeachers.map(assignedTeacher => {
      //   return {
      //     id: assignedTeacher.id,
      //     academicTerm: assignedTeacher.AcademicTerm.name,
      //     user: {
      //       id: assignedTeacher.User.id,
      //       firstName: assignedTeacher.User.firstName,
      //       lastName: assignedTeacher.User.lastName
      //     },
      //     section: {
      //       id: assignedTeacher.Section.id,
      //       name: assignedTeacher.Section.name,
      //       capacity: assignedTeacher.Section.capacity,
      //       class: {
      //         id: assignedTeacher.Section.Class.id,
      //         name: assignedTeacher.Section.Class.name,
      //         grade: assignedTeacher.Section.Class.grade
      //       }
      //     }
      //   };
      // });

      return res.status(200).json({ 'all active assigned teachers': activeAssignedTeachers });
    } catch (error) {
      console.error('Error fetching active assigned teachers:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Get a teacher's active assigned classes
exports.activeAssignedTeacher = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const teacherId = req.params.id;

      const isExist = await User.findOne({ where: { id: teacherId } });
      if (!isExist)
        return res.status(400).json({ message: `Teacher could not be found!` });

      const activeAssignedTeachers = await AssignedTeacher.findAll({
        where: { teacherId: teacherId },
        include: [
          {
            model: AcademicTerm,
            where: { status: 'Active' },
            attributes: ['name', 'status'],
          },
          {
            model: User,
            attributes: ['firstName', 'lastName'],
          },
          {
            model: Section,
            attributes: ['name', 'capacity'],
            include: {
              model: Class,
              attributes: ['name', 'grade'],
              order: [['grade', 'DESC']],
            }
          }
        ]
      });

      return res.status(200).json({ "teacher's active assigned classes": activeAssignedTeachers });
    } catch (error) {
      console.error('Error fetching active assigned teachers:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};
