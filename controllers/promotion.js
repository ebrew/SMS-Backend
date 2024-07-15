const { Op } = require('sequelize');
const passport = require('../db/config/passport')
const { ClassStudent, Student, ClassSession} = require("../db/models/index")
const { validateAcademicYear, validateClassSession, validateStudents, validateGrades, getPromotionEligibility, getNextClassSessionId, fetchAcademicYears } = require('../utility/promotion');

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

// Promote all students with pass mark
exports.promoteAllStudentsWithPassMark = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { passMark } = req.body;
      if (passMark === undefined)
        return res.status(400).json({ message: 'Incomplete field!' });

      // Validate academic year
      const { activeYear, pendingYear } = await fetchAcademicYears();

      // Validate class sessions
      const classSessions = await ClassSession.findAll({ where: { academicYearId: activeYear.id } });

      const promotions = [];
      const updates = [];
      const newRecords = [];

      // Process each class session
      for (const classSession of classSessions) {
        const students = await validateStudents(activeYear.id, classSession.id);

        for (const student of students) {
          const grades = await validateGrades(student.studentId, activeYear.academicTermId);
          const totalScore = getTotalScore(grades);
          const isEligible = getPromotionEligibility(totalScore, passMark);
          const status = isEligible ? 'Promoted' : 'Repeated';

          // Prepare update for current class session status
          updates.push({
            studentId: student.studentId,
            classSessionId: classSession.id,
            status
          });

          if (isEligible) {
            const nextClassSessionId = await getNextClassSessionId(classSession.id);
            const maxGrade = await ClassSession.max('grade');
            const nextClassSession = await ClassSession.findByPk(nextClassSessionId);

            if (nextClassSession && nextClassSession.grade > maxGrade) {
              // Mark as graduated if the next class session grade is greater than the max grade
              updates.push({
                studentId: student.studentId,
                classSessionId: classSession.id,
                status: 'Graduated'
              });
            } else {
              // Create a new record for the next academic year with 'Not Yet' status
              const existingRecord = await ClassStudent.findOne({
                where: {
                  studentId: student.studentId,
                  classSessionId: nextClassSessionId,
                  academicYearId: pendingYear.id,
                },
              });
              if (!existingRecord) {
                newRecords.push({
                  studentId: student.studentId,
                  classSessionId: nextClassSessionId,
                  academicYearId: pendingYear.id,
                  status: 'Not Yet'
                });
              }
            }
          }

          promotions.push({ studentId: student.studentId, fullName: getFullName(student.Student), status });
        }
      }

      // Perform batch updates for current class session status
      for (const update of updates) {
        await ClassStudent.update(
          { status: update.status },
          { where: { studentId: update.studentId, classSessionId: update.classSessionId } }
        );
      }

      // Insert new records in batch if they do not exist
      await ClassStudent.bulkCreate(newRecords, {
        ignoreDuplicates: true // Ensure this option is available for the Sequelize version you're using
      });

      res.status(200).json({ message: 'Students promoted successfully!', promotions });
    } catch (error) {
      console.error('Error promoting students:', error);
      res.status(500).json({ message: "Can't promote students at the moment!" });
    }
  });
};

// Promote class students with pass mark
exports.promoteClassStudentsWithPassMark = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { classSessionId, nextClassSessionId, passMark } = req.body;
      if (!classSessionId || !nextClassSessionId || passMark === undefined)
        return res.status(400).json({ message: 'Incomplete field!' });

      // Validate class sessions
      const { classSession, nextClassSession } = await validateClassSession(classSessionId, nextClassSessionId);

      // Fetch academic years
      const { activeYear, pendingYear } = await fetchAcademicYears();

      // Validate students
      const students = await validateStudents(activeYear.id, classSession.id);

      const promotions = [];
      const statusUpdates = [];
      const newRecords = [];

      for (const student of students) {
        const grades = await validateGrades(student.studentId, activeYear.academicTermId);
        const totalScore = getTotalScore(grades);
        const isEligible = getPromotionEligibility(totalScore, passMark);
        const status = isEligible ? 'Promoted' : 'Repeated';

        // Collect status updates for batch processing
        statusUpdates.push({
          studentId: student.studentId,
          classSessionId: classSession.id,
          status
        });

        if (isEligible) {
          // Prepare new record for the next academic year with 'Not Yet' status
          const existingRecord = await ClassStudent.findOne({
            where: {
              studentId: student.studentId,
              classSessionId: nextClassSession.id,
              academicYearId: pendingYear.id,
            },
          });
          if (!existingRecord) {
            newRecords.push({
              studentId: student.studentId,
              classSessionId: nextClassSession.id,
              academicYearId: pendingYear.id,
              status: 'Not Yet'
            });
          }
        }

        promotions.push({
          studentId: student.studentId,
          fullName: getFullName(student.Student),
          status
        });
      }

      // Batch update current class session status
      const studentIdsToUpdate = statusUpdates.map(update => update.studentId);
      const statusMap = statusUpdates.reduce((acc, update) => {
        acc[update.studentId] = update.status;
        return acc;
      }, {});

      await ClassStudent.update(
        { status: sequelize.literal(`CASE studentId ${statusMap} END`) },
        { where: { studentId: studentIdsToUpdate, classSessionId: classSession.id } }
      );

      // Batch insert new records if they do not exist
      await ClassStudent.bulkCreate(newRecords, {
        ignoreDuplicates: true
      });

      res.status(200).json({ message: 'Class students promoted successfully!', promotions });
    } catch (error) {
      console.error('Error promoting class students:', error);
      res.status(500).json({ message: "Can't promote class students at the moment!" });
    }
  });
};

// Promote class students without pass mark
exports.promoteClassStudents = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { classSessionId, nextClassSessionId } = req.body;
      if (!classSessionId || !nextClassSessionId)
        return res.status(400).json({ message: 'Incomplete field!' });

      // Validate class sessions
      const { classSession, nextClassSession } = await validateClassSession(classSessionId, nextClassSessionId);

      // fetch academic years
      const { activeYear, pendingYear } = await fetchAcademicYears();

      // Validate students
      const students = await validateStudents(activeYear.id, classSession.id);

      // Collect student IDs for batch operations
      const studentIds = students.map(student => student.studentId);

      // Update current class session status in batch
      await ClassStudent.update(
        { status: 'Promoted' },
        { where: { studentId: studentIds, classSessionId: classSession.id } }
      );

      // Prepare new records for the next academic year
      const newRecords = students.map(student => ({
        studentId: student.studentId,
        classSessionId: nextClassSession.id,
        academicYearId: pendingYear.id,
        status: 'Not Yet'
      }));

      // Insert new records if they do not exist
      await ClassStudent.bulkCreate(newRecords, {
        ignoreDuplicates: true // I need to verify if this option is available for this versions of Sequelize
      });

      // Prepare promotion result for response
      const promotions = students.map(student => ({
        studentId: student.studentId,
        fullName: getFullName(student.Student),
        status: 'Promoted'
      }));

      res.status(200).json({ message: 'Class students promoted successfully!', promotions });
    } catch (error) {
      console.error('Error promoting class students:', error);
      // res.status(500).json({ message: "Can't promote class students at the moment!" });
      return null;
    }
  });
};

// Update a single student's promotion
exports.updateStudentPromotion = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { classSessionId, nextClassSessionId, studentId } = req.body;
      if (!classSessionId || !nextClassSessionId || !studentId)
        return res.status(400).json({ message: 'Incomplete field!' });

      // Validate class sessions
      const { classSession, nextClassSession } = await validateClassSession(classSessionId, nextClassSessionId);

      // Fetch academic years
      const { activeYear, pendingYear } = await fetchAcademicYears();

      // Validate student
      const student = await ClassStudent.findOne({
        where: {
          academicYearId: activeYear.id,
          classSessionId,
          studentId
        },
        include: [{ model: Student }]
      });
      if (!student) return res.status(404).json({ message: 'Student not found!' });

      // Update current class session status
      await ClassStudent.update(
        { status: 'Promoted' },
        { where: { studentId: student.studentId, classSessionId: classSession.id } }
      );

      // Check if a record exists for the next class session and academic year
      const existingRecord = await ClassStudent.findOne({
        where: {
          studentId: student.studentId,
          classSessionId: nextClassSession.id,
          academicYearId: pendingYear.id,
        },
      });

      if (existingRecord) {
        // Update the status if the record exists
        await ClassStudent.update(
          { status: 'Not Yet' },
          { where: { studentId: student.studentId, classSessionId: nextClassSession.id, academicYearId: pendingYear.id } }
        );
      } else {
        // Create a new record if it doesn't exist
        await ClassStudent.create({
          studentId: student.studentId,
          classSessionId: nextClassSession.id,
          academicYearId: pendingYear.id,
          status: 'Not Yet'
        });
      }

      const promotion = {
        studentId: student.studentId,
        fullName: getFullName(student.Student),
        status: 'Promoted'
      };

      res.status(200).json({ message: 'Student promoted successfully!', promotion });
    } catch (error) {
      console.error('Error promoting student:', error);
      res.status(500).json({ message: "Can't promote student at the moment!" });
    }
  });
};
