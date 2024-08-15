const passport = require('../db/config/passport');
const db = require("../db/models/index")
const { Op } = require('sequelize');

// Mark attendance
exports.markAttendance = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { students, academicTermId, status } = req.body;

      // Validate request body
      if (!students || !academicTermId || !status) return res.status(400).json({ message: 'Incomplete or invalid field!' });

      if (status !== 'Present' && status !== 'Absent') return res.status(400).json({ message: 'Unexpected field input!' });

      // Ensure there are student IDs to process
      if (students.length === 0) return res.status(400).json({ message: 'No valid student IDs provided!' });
      

      // Start a transaction to ensure atomicity
      const transaction = await db.sequelize.transaction();

      try {
        // Get today's date without time component
        const today = new Date().toISOString().slice(0, 10);

        // Process each student
        const attendancePromises = students.map(async (studentId) => {
          const [attendance, created] = await db.Attendance.findOrCreate({
            where: { studentId, academicTermId, date: today },
            defaults: { status },
            transaction
          });

          // update the status if not created
          if (!created) {
            await attendance.update({ status }, { transaction });
          }
        });

        // Execute all attendance operations concurrently
        await Promise.all(attendancePromises);

        // Commit transaction
        await transaction.commit();

        return res.status(200).json({ message: 'Attendance marked successfully!' });
      } catch (error) {
        // Rollback transaction in case of error
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error marking attendance:', error);
      return res.status(500).json({ message: "Can't mark attendance at the moment!" });
    }
  })(req, res);
};

// Fetch a class students' attendance for a particular date
exports.ClassStudentsAttendance = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { classSessionId, date } = req.params;

      // Validate date format (YYYY-MM-DD)
      const isValidDate = (dateString) => {
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        return regex.test(dateString) && !isNaN(Date.parse(dateString));
      };

      if (!isValidDate(date)) return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD.' });

      // Fetch section and active academic year data concurrently
      const [section, activeYear] = await Promise.all([
        db.Section.findByPk(classSessionId, {
          include: {
            model: db.Class,
            attributes: ['name'],
          },
        }),
        db.AcademicYear.findOne({
          where: { status: 'Active' },
          attributes: ['id'],
        })
      ]);

      if (!section) return res.status(400).json({ message: "Class section not found!" });
      if (!activeYear) return res.status(400).json({ message: "No active academic year running!" });

      // Fetch students in the class session for the academic year
      const students = await db.ClassStudent.findAll({
        where: {
          classSessionId,
          academicYearId: activeYear.id
        },
        include: {
          model: db.Student,
          attributes: ['id', 'firstName', 'middleName', 'lastName', 'passportPhoto'],
        }
      });

      if (students.length === 0) return res.status(404).json({ message: "No students found!" });

      // Fetch attendance records for all students in the class session and date
      const attendanceRecords = await db.Attendance.findAll({
        where: {
          studentId: students.map(s => s.studentId),
          date, // Assuming the academicTermId logic is elsewhere
        },
        attributes: ['studentId', 'status'],
      });

      // Create a map for quick lookup of attendance status
      const attendanceMap = attendanceRecords.reduce((acc, record) => {
        acc[record.studentId] = record.status;
        return acc;
      }, {});

      // Generate attendance summary
      const attendanceSummary = students.map((student) => {
        if (!student.Student) return null;

        const fullName = student.Student.middleName
          ? `${student.Student.firstName} ${student.Student.middleName} ${student.Student.lastName}`
          : `${student.Student.firstName} ${student.Student.lastName}`;

        return {
          studentId: student.Student.id,
          fullName,
          photo: student.Student.passportPhoto,
          status: attendanceMap[student.Student.id] || 'Not Yet',
        };
      }).filter(Boolean);

      return res.status(200).json({ attendance: attendanceSummary });
    } catch (error) {
      console.error('Error fetching students attendance:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  })(req, res);
};


// Fetch a student's attendance for a particular period
exports.periodicStudentsAttendance = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { startDate, endDate, studentId } = req.body;

      // Fetch student data
      const student = await db.Student.findByPk(studentId, {
        attributes: ['id', 'firstName', 'middleName', 'lastName', 'passportPhoto']
      });

      if (!student) return res.status(404).json({ message: "Student not found!" });

      // Fetch attendance records for the given date range
      const attendanceRecords = await db.Attendance.findAll({
        where: { 
          studentId,
          date: {
            [Op.between]: [startDate, endDate],
          },
        },
        attributes: ['date', 'status'],
        order: [['date', 'ASC']] 
      });

      // Prepare the attendance summary
      const attendanceSummary = {
        studentId: student.id,
        fullName: student.middleName
          ? `${student.firstName} ${student.middleName} ${student.lastName}`
          : `${student.firstName} ${student.lastName}`,
        photo: student.passportPhoto,
        attendanceRecords 
      };

      return res.status(200).json({ attendance: attendanceSummary });
    } catch (error) {
      console.error('Error fetching student attendance:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  })(req, res);
};




