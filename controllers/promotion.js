const passport = require('../db/config/passport')
const { validateClassSession, fetchAcademicYears } = require('../utility/promotion');
const db = require("../db/models/index")

// Promote class students without pass mark
exports.promoteClassStudents = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { students, nextClassSessionId } = req.body;
      if (!students || !nextClassSessionId || !Array.isArray(students) || students.length === 0)
        return res.status(400).json({ message: 'Incomplete or invalid field!' });

      // Validate student IDs
      const studentIds = students.map(student => student.id);
      if (studentIds.length === 0)
        return res.status(400).json({ message: 'No valid student IDs provided!' });

      // Fetch academic years
      const { activeYear, pendingYear } = await fetchAcademicYears();

      // Determine current class session based on active year
      const currentClassSessions = await db.ClassStudent.findAll({
        where: { studentId: studentIds, academicYearId: activeYear.id },
        include: [{ model: db.Section }]
      });

      if (!currentClassSessions || currentClassSessions.length === 0)
        return res.status(404).json({ message: 'Current class session not found for the students!' });

      const currentClassSessionIds = currentClassSessions.map(session => session.Section.id);

      // Validate next class session
      // const nextClassSession = await db.Section.findByPk(nextClassSessionId);
      // if (!nextClassSession) return res.status(404).json({ message: 'Promotion class session not found!' });
      const nextClassSession = await validateClassSession(nextClassSessionId);

      // Start a transaction
      const transaction = await db.sequelize.transaction();

      try {
        // Update current class session status in batch
        await db.ClassStudent.update(
          { status: 'Promoted' },
          { where: { studentId: studentIds, classSessionId: currentClassSessionIds }, transaction }
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
        const newRecords = students
          .filter(student => !existingStudentIds.has(student.id))
          .map(student => ({
            studentId: student.id,
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
        const promotions = students.map(student => ({
          studentId: student.id,
          status: 'Promoted'
        }));

        res.status(200).json({ message: 'Class students promoted successfully!', promotions });
      } catch (error) {
        // Rollback transaction in case of error
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error promoting class students:', error);

      // Check for specific error messages
      if (error.message === 'No active academic year found!') {
        return res.status(400).json({ message: 'No active academic year found!' });
      } else if (error.message === 'No promotion academic year found!') {
        return res.status(400).json({ message: 'No promotion academic year found!' });
      } else if (error.message === 'Current class session not found for the students!') {
        return res.status(404).json({ message: 'Current class session not found for the students!' });
      } else if (error.message === 'Promotion class session not found!') {
        return res.status(404).json({ message: 'Promotion class session not found!' });
      } else if (error.message === 'No students found for this class session and academic year!') {
        return res.status(404).json({ message: 'No students found for this class session and academic year!' });
      }

      return res.status(500).json({ message: "Can't promote class students at the moment!" });
    }
  });
};

// Repeat class students
exports.repeatClassStudents = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    const { students } = req.body;
    if (!students || !Array.isArray(students) || students.length === 0) 
      return res.status(400).json({ message: 'Incomplete or invalid field!' });

    const studentIds = students.map(student => student.id);
    if (studentIds.length === 0) 
      return res.status(400).json({ message: 'No valid student IDs provided!' });

    try {
      const { activeYear, pendingYear } = await fetchAcademicYears();

      // Determine the current class session based on the active year
      const currentClassSession = await db.ClassStudent.findOne({
        where: { studentId: studentIds[0], academicYearId: activeYear.id },
        include: [{ model: db.Section }]
      });

      if (!currentClassSession || !currentClassSession.Section) 
        return res.status(404).json({ message: 'Current class session not found for the students!' });

      const repeatedClassSession = currentClassSession.Section; // Use the same session for repeating students

      // Start a transaction
      const transaction = await db.sequelize.transaction();

      try {
        // Update current class session status in batch to 'Repeated'
        await db.ClassStudent.update(
          { status: 'Repeated' },
          { where: { studentId: studentIds, classSessionId: currentClassSession.Section.id }, transaction }
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
        const newRecords = students
          .filter(student => !existingStudentIds.has(student.id))
          .map(student => ({
            studentId: student.id,
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
        const repetitions = students.map(student => ({
          studentId: student.id,
          status: 'Repeated'
        }));

        res.status(200).json({ message: 'Class students repeated successfully!', repetitions });
      } catch (error) {
        // Rollback transaction in case of error
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error repeating class students:', error);

      // Check for specific error messages
      if (error.message === 'No active academic year found!') {
        return res.status(400).json({ message: 'No active academic year found!' });
      } else if (error.message === 'No promotion academic year found!') {
        return res.status(400).json({ message: 'No promotion academic year found!' });
      } else if (error.message === 'Current class session not found for the students!') {
        return res.status(404).json({ message: 'Current class session not found for the students!' });
      } else if (error.message === 'Next class session not found!') {
        return res.status(404).json({ message: 'Next class session not found!' });
      } else if (error.message === 'No students found for this class session and academic year!') {
        return res.status(404).json({ message: 'No students found for this class session and academic year!' });
      }

      return res.status(500).json({ message: "Can't repeat class students at the moment!" });
    }
  });
};


