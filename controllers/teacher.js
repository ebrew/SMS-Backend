require('dotenv').config();
var express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op, or, and } = require('sequelize');
const passport = require('../db/config/passport')
const { User, Student, Section, Class, AssignedTeacher, AssignedSubject, Subject, ClassStudent } = require("../db/models/index")
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

// Get a teacher's assigned class's subjects and students
exports.teacherClassSubjectAndStudent = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { classSessionId, assignedTeacherId } = req.params;

      // Fetching class' assigned subjects
      const subjects = await AssignedSubject.findAll({
        where: { assignedTeacherId },
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
        order: [['firstName', 'ASC']],
        include: {
          model: Student,
          attributes: ['id', 'firstName', 'middleName', 'lastName'],
        }
      });

      const classStudents = students.map(student => ({
        studentId: student.Student.id,
        fullName: student.Student.middleName 
          ? `${student.Student.firstName} ${student.Student.middleName} ${student.Student.lastName}`
          : `${student.Student.firstName} ${student.Student.lastName}`,
        academicYearId: activeAcademicYear.id
      }));

      const result = {
        classStudents,
        assignedSubjects
      };

      return res.status(200).json({ assigned: result });
    } catch (error) {
      console.error('Error fetching teacher class subjects and students:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};
