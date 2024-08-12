const passport = require('../db/config/passport')
const { validateClassSession, fetchAcademicYears, validateAcademicYears } = require('../utility/promotion');
const db = require("../db/models/index")
const logUserAction = require('../utility/logUserAction');

exports.promoteClassStudents = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' }); 

    try {
      const { students, nextClassSessionId } = req.body;

      if (!students || !nextClassSessionId || !Array.isArray(students) || students.length === 0)
        return res.status(400).json({ message: 'Incomplete or invalid field!' });

      // Validate student IDs
      const studentIds = students;
      if (studentIds.length === 0)
        return res.status(400).json({ message: 'No valid student IDs provided!' });

      // const { activeYear, pendingYear }  = await fetchAcademicYears();

      let activeYear, pendingYear
      try {
        // Fetch academic years
        ({ activeYear, pendingYear }  = await fetchAcademicYears());
      } catch (validationError) {
        console.error('Validation Error:', validationError.message);
        return res.status(400).json({ message: validationError.message });
      }

      // Determine current class session based on active year
      const currentClassSessions = await db.ClassStudent.findAll({
        where: { studentId: studentIds, academicYearId: activeYear.id },
        include: [{ model: db.Section }]
      });

      if (!currentClassSessions || currentClassSessions.length === 0)
        return res.status(404).json({ message: 'Current class session not found for the students!' });

      const currentClassSessionIds = currentClassSessions.map(session => session.Section.id);

      // Validate next class session
      const nextClassSession = await validateClassSession(nextClassSessionId);

      // Start a transaction to ensure atomicity
      const transaction = await db.sequelize.transaction();

      try {
        // Fetch repeated students for updates on promotions
        const repeatedStudents = await db.ClassStudent.findAll({
          where: {
            studentId: studentIds,
            classSessionId: currentClassSessionIds[0], // Adjusted to use first current class session ID
            academicYearId: activeYear.id,
            status: 'Repeated'
          },
          transaction
        });

        // Update repeated students' pendingYear records before the actual promotions
        await db.ClassStudent.update(
          { classSessionId: nextClassSession.id },
          {
            where: {
              studentId: repeatedStudents.map(student => student.studentId),
              academicYearId: pendingYear.id
            },
            transaction
          }
        );

        // Update current class session status in batch
        await db.ClassStudent.update(
          { status: 'Promoted', promotedTo: nextClassSession.id },
          {
            where: {
              academicYearId: activeYear.id,
              studentId: studentIds,
              classSessionId: currentClassSessionIds
            },
            transaction
          }
        );

        // Fetch existing records in the next class session
        const existingRecords = await db.ClassStudent.findAll({
          where: {
            studentId: studentIds,
            classSessionId: nextClassSession.id,
            academicYearId: pendingYear.id
          },
          transaction
        });

        // Get existing student IDs
        const existingStudentIds = new Set(existingRecords.map(record => record.studentId));

        // Prepare new records for the next academic year, excluding existing ones
        const newRecords = studentIds
          .filter(studentId => !existingStudentIds.has(studentId))
          .map(studentId => ({
            studentId,
            classSessionId: nextClassSession.id,
            academicYearId: pendingYear.id,
            status: 'Not Yet'
          }));

        // Insert new records if any
        if (newRecords.length > 0) {
          await db.ClassStudent.bulkCreate(newRecords, { transaction });
        }

        // Commit transaction
        await transaction.commit();

        // Prepare promotion result for response
        const promotions = studentIds.map(studentId => ({
          studentId,
          status: 'Promoted'
        }));

        await logUserAction('User', req.user.id, `Promoted students to ${nextClassSession.name}`, `${promotions}`)

        res.status(200).json({ message: 'Class students promoted successfully!', promotions });
      } catch (error) {
        // Rollback transaction in case of error
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error promoting class students:', error);

      return res.status(500).json({ message: "Can't promote class students at the moment!" });
    }
  })(req, res);
};

// Promote class students by Admin (Complexity)
exports.promoteClassStudentsByAdmin = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { students, nextAcademicYearId, nextClassSessionId } = req.body;
      if (!students || !nextAcademicYearId || !nextClassSessionId || !Array.isArray(students) || students.length === 0) {
        return res.status(400).json({ message: 'Incomplete or invalid field!' });
      }

      // Validate student IDs
      const studentIds = students.map(student => student.id);
      if (studentIds.length === 0) {
        return res.status(400).json({ message: 'No valid student IDs provided!' });
      }

      let activeYear, pendingYear
      try {
        ({ activeYear, pendingYear } = await validateAcademicYears(nextAcademicYearId));
      } catch (validationError) {
        console.error('Validation Error:', validationError.message);
        return res.status(400).json({ message: validationError.message });
      }

      // Determine current class session based on active year
      const currentClassSessions = await db.ClassStudent.findAll({
        where: { studentId: studentIds, academicYearId: activeYear.id },
        include: [{ model: db.Section }]
      });

      if (!currentClassSessions || currentClassSessions.length === 0) {
        return res.status(404).json({ message: 'Current class session not found for the students!' });
      }

      const currentClassSessionIds = currentClassSessions.map(session => session.Section.id);

      // Validate next class session
      const nextClassSession = await validateClassSession(nextClassSessionId);

      // Start a transaction to ensure atomicity
      const transaction = await db.sequelize.transaction();

      try {
        // Fetch repeated students for updates on promotions
        const repeatedStudents = await db.ClassStudent.findAll({
          where: {
            studentId: studentIds,
            classSessionId: currentClassSessionIds[0],
            academicYearId: activeYear.id,
            status: 'Repeated'
          },
          transaction
        });

        // Update repeated students' class session records before the actual promotions
        await db.ClassStudent.update(
          { classSessionId: nextClassSession.id },
          {
            where: {
              studentId: repeatedStudents.map(student => student.studentId),
              academicYearId: pendingYear.id
            },
            transaction
          }
        );

        // Update current class session status in batch
        await db.ClassStudent.update(
          { status: 'Promoted', promotedTo: nextClassSession.id },
          {
            where: {
              academicYearId: activeYear.id,
              studentId: studentIds,
              classSessionId: currentClassSessionIds
            },
            transaction
          }
        );

        // Fetch existing records in the next class session to avoid duplicates
        const existingRecords = await db.ClassStudent.findAll({
          where: {
            studentId: studentIds,
            classSessionId: nextClassSession.id,
            academicYearId: pendingYear.id
          },
          transaction
        });

        // Get existing student IDs
        const existingStudentIds = new Set(existingRecords.map(record => record.studentId));

        // Prepare new records for the next academic year, excluding existing ones
        const newRecords = studentIds
          .filter(studentId => !existingStudentIds.has(studentId))
          .map(studentId => ({
            studentId,
            classSessionId: nextClassSession.id,
            academicYearId: pendingYear.id,
            status: 'Not Yet'
          }));

        // Insert new records if any
        if (newRecords.length > 0) {
          await db.ClassStudent.bulkCreate(newRecords, { transaction });
        }

        // Commit transaction
        await transaction.commit();

        // Prepare promotion result for response
        const promotions = studentIds.map(studentId => ({
          studentId,
          status: 'Promoted'
        }));

        await logUserAction('User', req.user.id, `Promoted students to ${nextClassSession.name}`, `${promotions}`)

        res.status(200).json({ message: 'Students promoted successfully!', promotions });
      } catch (error) {
        // Rollback transaction in case of error
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error promoting class students:', error);
      return res.status(500).json({ message: "Can't promote class students at the moment!" });
    }
  }) (req, res);
};

// Repeat class students by head teacher
exports.repeatClassStudents = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' }); 

    const { students } = req.body;
    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ message: 'Incomplete or invalid field!' });
    }

    const studentIds = students;
    if (studentIds.length === 0) {
      return res.status(400).json({ message: 'No valid student IDs provided!' });
    }

    try {
      // // Fetch academic years
      // const { activeYear, pendingYear } = await fetchAcademicYears();
      let activeYear, pendingYear
      try {
        ({ activeYear, pendingYear }  = await fetchAcademicYears());
      } catch (validationError) {
        console.error('Validation Error:', validationError.message);
        return res.status(400).json({ message: validationError.message });
      }

      // Determine the current class session based on the active year
      const currentClassSession = await db.ClassStudent.findOne({
        where: { studentId: studentIds[0], academicYearId: activeYear.id },
        include: [{ model: db.Section }]
      });

      if (!currentClassSession || !currentClassSession.Section) {
        return res.status(404).json({ message: 'Current class session not found for the students!' });
      }

      const repeatedClassSession = currentClassSession.Section;

      // Start a transaction to ensure atomicity
      const transaction = await db.sequelize.transaction();

      try {
        // Fetch promoted students for updates on repeating
        const promotedStudents = await db.ClassStudent.findAll({
          where: {
            studentId: studentIds,
            classSessionId: repeatedClassSession.id,
            academicYearId: activeYear.id,
            status: 'Promoted'
          },
          transaction
        });

        // Updating promoted students' pendingYear records before the actual repeating
        await db.ClassStudent.update(
          { classSessionId: repeatedClassSession.id, promotedTo: null },
          {
            where: {
              studentId: promotedStudents.map(student => student.studentId),
              academicYearId: pendingYear.id
            },
            transaction
          }
        );

        // Update current class session status in batch to 'Repeated'
        await db.ClassStudent.update(
          { status: 'Repeated', promotedTo: null },
          {
            where: {
              academicYearId: activeYear.id,
              studentId: studentIds,
              classSessionId: repeatedClassSession.id
            },
            transaction
          }
        );

        // Fetch existing records in the next class session
        const existingRecords = await db.ClassStudent.findAll({
          where: {
            studentId: studentIds,
            classSessionId: repeatedClassSession.id,
            academicYearId: pendingYear.id
          },
          transaction
        });

        // Get existing student IDs
        const existingStudentIds = new Set(existingRecords.map(record => record.studentId));

        // Prepare new records for the next academic year, excluding existing ones
        const newRecords = studentIds
          .filter(studentId => !existingStudentIds.has(studentId))
          .map(studentId => ({
            studentId,
            classSessionId: repeatedClassSession.id,
            academicYearId: pendingYear.id,
            status: 'Not Yet'
          }));

        // Insert new records if any
        if (newRecords.length > 0) {
          await db.ClassStudent.bulkCreate(newRecords, { transaction });
        }

        // Commit transaction
        await transaction.commit();

        // Prepare repetition result for response
        const repetitions = studentIds.map(studentId => ({
          studentId,
          status: 'Repeated'
        }));

        await logUserAction('User', req.user.id, `Repeated students`, `${repetitions}`)

        res.status(200).json({ message: 'Class students repeated successfully!', repetitions });
      } catch (error) {
        // Rollback transaction in case of error
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error repeating class students:', error);

      return res.status(500).json({ message: "Can't repeat class students at the moment!" });
    }
  })(req, res);
};

// Repeat class students by Admin (Complexity)
exports.repeatClassStudentsByAdmin = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' }); 

    const { students, nextAcademicYearId } = req.body;
    if (!students || !nextAcademicYearId || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ message: 'Incomplete or invalid field!' });
    }

    const studentIds = students.map(student => student.id);
    if (studentIds.length === 0) {
      return res.status(400).json({ message: 'No valid student IDs provided!' });
    }

    try {
      let activeYear, pendingYear
      try {
        ({ activeYear, pendingYear } = await validateAcademicYears(nextAcademicYearId));
      } catch (validationError) {
        console.error('Validation Error:', validationError.message);
        return res.status(400).json({ message: validationError.message });
      }

      // Determine the current class session based on the active year
      const currentClassSession = await db.ClassStudent.findOne({
        where: { studentId: studentIds[0], academicYearId: activeYear.id },
        include: [{ model: db.Section }]
      });

      if (!currentClassSession || !currentClassSession.Section) {
        return res.status(404).json({ message: 'Current class session not found for the students!' });
      }

      const repeatedClassSession = currentClassSession.Section;

      // Start a transaction to ensure atomicity
      const transaction = await db.sequelize.transaction();

      try {
        // Fetch promoted students for updates on repeating
        const promotedStudents = await db.ClassStudent.findAll({
          where: {
            studentId: studentIds,
            classSessionId: repeatedClassSession.id,
            academicYearId: activeYear.id,
            status: 'Promoted'
          },
          transaction
        });

        // Update promoted students' class session records before the actual repeating
        await db.ClassStudent.update(
          { classSessionId: repeatedClassSession.id },
          {
            where: {
              studentId: promotedStudents.map(student => student.studentId),
              academicYearId: pendingYear.id
            },
            transaction
          }
        );

        // Update current class session status in batch to 'Repeated'
        await db.ClassStudent.update(
          { status: 'Repeated', promotedTo: null },
          {
            where: {
              academicYearId: activeYear.id,
              studentId: studentIds,
              classSessionId: repeatedClassSession.id
            },
            transaction
          }
        );

        // Fetch existing records in the next class session to avoid duplicates
        const existingRecords = await db.ClassStudent.findAll({
          where: {
            studentId: studentIds,
            classSessionId: repeatedClassSession.id,
            academicYearId: pendingYear.id
          },
          transaction
        });

        // Get existing student IDs
        const existingStudentIds = new Set(existingRecords.map(record => record.studentId));

        // Prepare new records for the next academic year, excluding existing ones
        const newRecords = studentIds
          .filter(studentId => !existingStudentIds.has(studentId))
          .map(studentId => ({
            studentId,
            classSessionId: repeatedClassSession.id,
            academicYearId: pendingYear.id,
            status: 'Not Yet'
          }));

        // Insert new records if any
        if (newRecords.length > 0) {
          await db.ClassStudent.bulkCreate(newRecords, { transaction });
        }

        // Commit transaction
        await transaction.commit();

        // Prepare repetition result for response
        const repetitions = studentIds.map(studentId => ({
          studentId,
          status: 'Repeated'
        }));
        await logUserAction('User', req.user.id, `Repeated students`, `${repetitions}`)

        res.status(200).json({ message: 'Students repeated successfully!', repetitions });
      } catch (error) {
        // Rollback transaction in case of error
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error repeating class students:', error);

      return res.status(500).json({ message: "Can't repeat class students at the moment!" });
    }
  })(req, res);
};







