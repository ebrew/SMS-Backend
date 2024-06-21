require('dotenv').config();
var express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op, or, and } = require('sequelize');
const passport = require('../db/config/passport')
const { User, Student, Section, Class, AssignedTeacher, AssignedSubject, Subject, ClassStudent, AcademicYear, Assessment, Grade } = require("../db/models/index")
const Mail = require('../utility/email');
const sendSMS = require('../utility/sendSMS');
const { normalizeGhPhone, extractIdAndRoleFromToken } = require('../utility/cleaning');


// Get all teachers
exports.allTeachers = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const teachers = await User.findAll({
        where: { role: 'Teacher' },
        order: [['firstName', 'ASC']],
        attributes: ['id', 'userName', 'firstName', 'lastName', 'role', 'email', 'phone', 'address', 'staffID', 'dob'],
      })
      return res.status(200).json({ 'teachers': teachers });
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Get a teacher's assigned classes after login
exports.getAssignedTeacherClass = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const teacherId = req.params.id;

      const assignedClass = await AssignedTeacher.findAll({
        where: { teacherId },
        include: {
          model: Section,
          attributes: ['id', 'name', 'capacity'],
          include: {
            model: Class,
            attributes: ['id', 'name', 'grade'],
          }
        },
        order: [[{ model: Section }, { model: Class }, 'grade', 'DESC']],
      });

      const assignedClasses = assignedClass.map(data => ({
        assignedTeacherId: data.id,
        classSectionId: data.Section.id,
        classSection: `${data.Section.Class.name} (${data.Section.name})`,
      }));

      return res.status(200).json({ assignedClasses });
    } catch (error) {
      console.error('Error fetching active assigned teachers:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Get a teacher's assigned class's students
exports.teacherClassStudents = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const classSessionId = req.params.id;

      // Find the active academic year and update its status if necessary
      let activeAcademicYear = await AcademicYear.findOne({ where: { status: 'Active' } });
      if (activeAcademicYear)
        await activeAcademicYear.setInactiveIfEndDateDue();

      activeAcademicYear = await AcademicYear.findOne({ where: { status: 'Active' } });
      if (!activeAcademicYear)
        return res.status(400).json({ message: "No active academic year available!" });

      // Fetching class students
      const students = await ClassStudent.findAll({
        where: { classSessionId, academicYearId: activeAcademicYear.id },
        include: {
          model: Student,
          attributes: ['id', 'firstName', 'middleName', 'lastName', 'address', 'passportPhoto'],
          order: [['firstName', 'ASC']],
        }
      });

      const classStudents = students.map(student => {
        if (!student.Student) {
          return null;
        }
        return {
          studentId: student.Student.id,
          fullName: student.Student.middleName
            ? `${student.Student.firstName} ${student.Student.middleName} ${student.Student.lastName}`
            : `${student.Student.firstName} ${student.Student.lastName}`,
          address: student.Student.address,
          photo: student.Student.passportPhoto
        };
      }).filter(student => student !== null);

      const result = {
        academicYearId: activeAcademicYear.id,
        classStudents
      };

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching teacher class students:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Get a teacher's assigned class's subjects
exports.teacherClassSubjects = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const { teacherId, classSessionId } = req.params;

      // Fetching the assigned teacher for the specified class session
      const assignedTeacher = await AssignedTeacher.findOne({ where: { teacherId, classId: classSessionId } });

      if (!assignedTeacher) {
        return res.status(400).json({ message: 'Assigned teacher not found for the specified class session.' });
      }

      // Fetching class' assigned subjects
      const subjects = await AssignedSubject.findAll({
        where: { assignedTeacherId: assignedTeacher.id },
        attributes: [],
        order: [['createdAt', 'DESC']],
        include: {
          model: Subject,
          attributes: ['id', 'name'],
        }
      });

      const assignedSubjects = subjects.map(data => ({
        assignedSubjectId: data.id,
        subjectId: `${data.Subject.id}`,
        subjectName: `${data.Subject.name}`,
      }));

      return res.status(200).json(assignedSubjects);
    } catch (error) {
      console.error('Error fetching teacher class subjects and students:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Create a new Assessment
exports.addAssessment = async (req, res) => {
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

      if (headTeacherId && headTeacherId !== '0') {
        const isExist = await User.findByPk(headTeacherId);

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
          await Section.create({ name, capacity, classId });
        } catch (error) {
          console.error('Error creating section:', error.message);
          // future error handling in the fure
          res.status(500).json({ message: "Can't create class sections at the moment!" });
        }
      }
      res.status(200).json({ message: 'Class and sections created successfully!' });

    } catch (error) {
      console.error('Error creating class and sections:', error);
      res.status(500).json({ message: "Can't create class at the moment!" });
    }
  });
};