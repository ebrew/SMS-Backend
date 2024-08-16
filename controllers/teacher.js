require('dotenv').config();
const passport = require('../db/config/passport')
const { Op } = require('sequelize');
const { User, Student, Section, Class, AssignedTeacher, AssignedSubject, Subject, ClassStudent, AcademicYear, Attendance } = require("../db/models/index")
const db = require("../db/models/index")

// Get all teachers
exports.allTeachers = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' });

    try {
      // Fetch all teachers
      const teachers = await User.findAll({
        where: { role: 'Teacher' },
        order: [['firstName', 'ASC']],
        attributes: ['id', 'userName', 'firstName', 'lastName', 'role', 'email', 'phone', 'address', 'staffID', 'dob'],
      });

      // Process each teacher to fetch assigned classes and subjects
      const promises = teachers.map(async (teacher) => {
        // Fetch assigned classes and include the count of assigned subjects
        const assignedClasses = await AssignedTeacher.findAll({
          where: { teacherId: teacher.id },
          include: {
            model: AssignedSubject,
            attributes: ['id'], 
          }
        });

        // Calculate the number of subjects
        let subjectsCount = 0;
        assignedClasses.forEach((assignedClass) => {
          subjectsCount += assignedClass.AssignedSubjects ? assignedClass.AssignedSubjects.length : 0;
        });

        return {
          id: teacher.id,
          fullName: `${teacher.firstName} ${teacher.lastName}`,
          email: teacher.email,
          phone: teacher.phone,
          address: teacher.address,
          dob: teacher.dob,
          assignedClassCount: assignedClasses.length,
          assignedSubjectCount: subjectsCount
        };
      });

      // Execute all promises concurrently and await their results
      const assignmentSummary = await Promise.all(promises);

      return res.status(200).json({ teachers: assignmentSummary });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!", error: error.message });
    }
  })(req, res);
};

// Get a teacher's assigned classes after login
exports.getAssignedTeacherClass = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' });

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
  })(req, res);
};

// Get a teacher's assigned class's students
exports.teacherClassStudents = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const classSessionId = req.params.id;

      // Find the active academic year and update its status if necessary
      let activeAcademicYear = await AcademicYear.findOne({ where: { status: 'Active' } });
      if (activeAcademicYear)
        await activeAcademicYear.setInactiveIfEndDateDue();

      activeAcademicYear = await AcademicYear.findOne({ where: { status: 'Active' } });
      if (!activeAcademicYear)
        return res.status(400).json({ message: "No active academic year available!" });

      // Fetching class students with promotedTo section only
      const students = await ClassStudent.findAll({
        where: { classSessionId, academicYearId: activeAcademicYear.id },
        include: [
          {
            model: Student,
            attributes: ['id', 'firstName', 'middleName', 'lastName', 'address', 'passportPhoto']
          },
          {
            model: Section,
            as: 'PromotedTo',
            include: [{ model: Class }]
          }
        ],
        order: [[{ model: Student }, 'firstName', 'ASC']]
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
          photo: student.Student.passportPhoto,
          status: student.status,
          promotedTo: student.PromotedTo
            ? `${student.PromotedTo.Class.name} (${student.PromotedTo.name})`
            : null
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
  })(req, res);
};

// Get a teacher's assigned class's subjects
exports.teacherClassSubjects = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' });

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
  })(req, res);
};

// Teacher subject assignment summary
exports.subjectAssignmentSummary = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { teacherId, classSessionId } = req.params;

      // Fetch active academic year and validate
      const year = await AcademicYear.findOne({
        where: { status: 'Active' },
        attributes: ['id']
      });
      if (!year) return res.status(404).json({ message: 'Active academic year not found!' });

      const academicYearId = year.id;

      // Fetch students and attendance in parallel for faster execution
      const [students, attendanceRecords] = await Promise.all([
        ClassStudent.findAll({
          where: {
            classSessionId,
            academicYearId
          },
          include: {
            model: Student,
            attributes: ['id', 'firstName', 'middleName', 'lastName', 'passportPhoto'],
          },
          attributes: ['studentId'] 
        }),
        Attendance.findAll({
          where: {
            date: new Date().toISOString().split('T')[0], // today's date in YYYY-MM-DD format
            studentId: {
              [Op.in]: db.Sequelize.literal(`(SELECT "studentId" FROM "ClassStudents" WHERE "classSessionId" = ${classSessionId} AND "academicYearId" = ${academicYearId})`)
            }
          },
          attributes: ['studentId', 'status']
        })
      ]);

      if (students.length === 0) return res.status(404).json({ message: "No students found!" });

      // Count students with different attendance statuses
      const presentCount = attendanceRecords.filter(record => record.status === 'Present').length;
      const absentCount = attendanceRecords.filter(record => record.status === 'Absent').length;
      const notMarkedCount = students.length - attendanceRecords.length;

      // Fetch the assigned classes and subjects for the teacher
      const assignedClass = await AssignedTeacher.findOne({
        where: { teacherId, classId: classSessionId },
        include: {
          model: AssignedSubject,
          attributes: ['id']
        },
        attributes: ['id']
      });

      // Create the summary object
      const summary = {
        studentsCount: students.length,
        subjectsCount: assignedClass?.AssignedSubjects?.length || 0,
        present: presentCount,
        absent: absentCount,
        notMarked: notMarkedCount
      };

      // Return the summary as a response
      return res.status(200).json(summary);
    } catch (error) {
      console.error('Error fetching subject assignment summary:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  })(req, res);
};





