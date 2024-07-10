const { Op } = require('sequelize');
const passport = require('../db/config/passport')
const { ClassStudent, Student, AcademicYear, ClassSession, Section } = require("../db/models/index")
const { validateAcademicYear, validateClassSession, validateStudents, validateGrades, getPromotionEligibility, getNextClassSessionId } = require('../utility/promotion');

// function to calculate total score
const getTotalScore = (grades) => {
  return grades.reduce((total, grade) => total + (parseFloat(grade.score) * grade.Assessment.weight / grade.Assessment.marks), 0);
};

// function to get full name of the student
const getFullName = (student) => {
  return student.middleName
    ? `${student.firstName} ${student.middleName} ${student.lastName}`
    : `${student.firstName} ${student.lastName}`;
};

// Promote all students
exports.promoteAllStudents = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { academicYearId, passMark } = req.body;
      if (!academicYearId || passMark === undefined)
        return res.status(400).json({ message: 'Incomplete field!' });

      // Validate academic year
      const academicYear = await validateAcademicYear(academicYearId);

      // Validate class sessions
      const classSessions = await ClassSession.findAll({ where: { academicYearId: academicYear.id } });

      const promotions = [];

      // Process each class session
      for (const classSession of classSessions) {
        const students = await validateStudents(academicYear.id, classSession.id);

        for (const student of students) {
          const grades = await validateGrades(student.studentId, academicYear.academicTermId);
          const totalScore = getTotalScore(grades);
          const isEligible = getPromotionEligibility(totalScore, passMark);
          const status = isEligible ? 'Promoted' : 'Repeated';

          // Update current class session status
          await ClassStudent.update(
            { status },
            { where: { studentId: student.studentId, classSessionId: classSession.id } }
          );

          // Determine the class session for the new record
          const nextClassSessionId = isEligible
            ? await getNextClassSessionId(classSession.id)
            : classSession.id;

          // Check if the record for the next academic year already exists
          const existingRecord = await ClassStudent.findOne({
            where: {
              studentId: student.studentId,
              classSessionId: nextClassSessionId,
              academicYearId: academicYear.id + 1
            }
          });

          // Create a new record for the next academic year with 'Not Yet' status if it doesn't exist
          if (!existingRecord) {
            await ClassStudent.create({
              studentId: student.studentId,
              classSessionId: nextClassSessionId,
              academicYearId: academicYear.id + 1,
              status: 'Not Yet'
            });
          }

          promotions.push({ studentId: student.studentId, fullName: getFullName(student.Student), status });
        }
      }

      res.status(200).json({ message: 'Students promoted successfully!', promotions });
    } catch (error) {
      console.error('Error promoting students:', error);
      res.status(500).json({ message: "Can't promote students at the moment!" });
    }
  });
};

// Promote students of a single class
exports.promoteClassStudents = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { academicYearId, classSessionId, passMark } = req.body;
      if (!academicYearId || !classSessionId || passMark === undefined)
        return res.status(400).json({ message: 'Incomplete field!' });

      // Validate academic year
      const academicYear = await validateAcademicYear(academicYearId);

      // Validate class session
      const classSession = await validateClassSession(classSessionId);

      // Validate students
      const students = await validateStudents(academicYear.id, classSession.id);

      const promotions = [];

      for (const student of students) {
        const grades = await validateGrades(student.studentId, academicYear.academicTermId);
        const totalScore = getTotalScore(grades);
        const isEligible = getPromotionEligibility(totalScore, passMark);
        const status = isEligible ? 'Promoted' : 'Repeated';

        // Update current class session status
        await ClassStudent.update(
          { status },
          { where: { studentId: student.studentId, classSessionId: classSession.id } }
        );

        // Determine the class session for the new record
        const nextClassSessionId = isEligible
          ? await getNextClassSessionId(classSession.id)
          : classSession.id;

        // Check if the record for the next academic year already exists
        const existingRecord = await ClassStudent.findOne({
          where: {
            studentId: student.studentId,
            classSessionId: nextClassSessionId,
            academicYearId: academicYear.id + 1
          }
        });

        // Create a new record for the next academic year with 'Not Yet' status if it doesn't exist
        if (!existingRecord) {
          await ClassStudent.create({
            studentId: student.studentId,
            classSessionId: nextClassSessionId,
            academicYearId: academicYear.id + 1,
            status: 'Not Yet'
          });
        }

        promotions.push({ studentId: student.studentId, fullName: getFullName(student.Student), status });
      }

      res.status(200).json({ message: 'Class students promoted successfully!', promotions });
    } catch (error) {
      console.error('Error promoting class students:', error);
      res.status(500).json({ message: "Can't promote class students at the moment!" });
    }
  });
};

// Promote a single student
exports.promoteSingleStudent = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { academicYearId, classSessionId, studentId, passMark } = req.body;
      if (!academicYearId || !classSessionId || !studentId || passMark === undefined)
        return res.status(400).json({ message: 'Incomplete field!' });

      // Validate academic year
      const academicYear = await validateAcademicYear(academicYearId);

      // Validate class session
      const classSession = await validateClassSession(classSessionId);

      // Validate student
      const students = await validateStudents(academicYear.id, classSession.id);
      const student = students.find(s => s.studentId === studentId);
      if (!student) throw new Error('Student not found in the specified class session and academic year!');

      // Validate grades
      const grades = await validateGrades(student.studentId, academicYear.academicTermId);
      const totalScore = getTotalScore(grades);
      const isEligible = getPromotionEligibility(totalScore, passMark);
      const status = isEligible ? 'Promoted' : 'Repeated';

      // Update current class session status
      await ClassStudent.update(
        { status },
        { where: { studentId: student.studentId, classSessionId: classSession.id } }
      );

      // Determine the class session for the new record
      const nextClassSessionId = isEligible
        ? await getNextClassSessionId(classSession.id)
        : classSession.id;

      // Check if the record for the next academic year already exists
      const existingRecord = await ClassStudent.findOne({
        where: {
          studentId: student.studentId,
          classSessionId: nextClassSessionId,
          academicYearId: academicYear.id + 1
        }
      });

      // Create a new record for the next academic year with 'Not Yet' status if it doesn't exist
      if (!existingRecord) {
        await ClassStudent.create({
          studentId: student.studentId,
          classSessionId: nextClassSessionId,
          academicYearId: academicYear.id + 1,
          status: 'Not Yet'
        });
      }

      res.status(200).json({ message: 'Student promoted successfully!', student: { studentId: student.studentId, fullName: getFullName(student.Student) } });
    } catch (error) {
      console.error('Error promoting student:', error);
      res.status(500).json({ message: "Can't promote student at the moment!" });
    }
  });
};

