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

        const newClass = await Section.findOne({ where: { id: classId }, include: { model: Class, attributes: ['name'] }  });
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
            const newSubject = await Subject.findOne({ where: { id: subjectId } }).name;
            subjectList.push(newSubject);
          }
        }
      }

      // Email prompt to the teacher
      const needed = (classList.length === 0 && subjectList.length === 0) ? false : true;
      if (needed) {
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
      
      return res.status(200).json({ 'all active assigned teachers': formattedResult });
    } catch (error) {
      console.error('Error fetching active assigned teachers:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Get a specific teacher's assigned classes
exports.assignedTeacher1 = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const teacherId = req.params.id;

      const isExist = await User.findByPk(teacherId);
      if (!isExist)
        return res.status(400).json({ message: `Teacher could not be found!` });

      const activeAssignedTeachers = await AssignedTeacher.findAll({
        where: { teacherId },
        include: [
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
              order: [['grade', 'DESC']],
            }
          }
        ]
      });

      // Array to store the formatted data
      const formattedResult = [];

      // Looping through activeAssignedTeachers and creating promises to fetch subjects
      for (const data of activeAssignedTeachers) {
        const assignedSubjects = await AssignedSubject.findAll({
          where: { assignedTeacherId: data.id },
          attributes: [], // not interested in any attributes
          order: [['createdAt', 'DESC']],
          include: {
            model: Subject,
            attributes: ['id', 'name'],
          }
        });

        // Check if the class ID already exists in the formatted result
        const existingClassIndex = formattedResult.findIndex(item => item.classId === data.Section.Class.id);

        if (existingClassIndex !== -1) {
          // If the class ID exists, push the section to its classes array
          formattedResult[existingClassIndex].classes.push({
            classId: data.Section.Class.id,
            sections: [{
              id: data.Section.id,
              name: data.Section.name,
              capacity: data.Section.capacity,
              subjects: assignedSubjects,
            }]
          });
        } else {
          // If the class ID doesn't exist, add the class and its section to the formatted result
          formattedResult.push({
            id: data.id,
            teacherId: data.teacherId,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            teacher: `${data.User.firstName} ${data.User.lastName}`,
            classes: [{
              class: data.Section.Class,
              sections: [{
                id: data.Section.id,
                name: data.Section.name,
                capacity: data.Section.capacity,
                subjects: assignedSubjects,
              }]
            }],
          });
        }
      }

      return res.status(200).json({ "all active assigned teachers": formattedResult });
    } catch (error) {
      console.error('Error fetching active assigned teachers:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Get a specific teacher's assigned classes
exports.assignedTeacher = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const teacherId = req.params.id;

      const isExist = await User.findByPk(teacherId);
      if (!isExist)
        return res.status(400).json({ message: `Teacher could not be found!` });

      const activeAssignedTeachers = await AssignedTeacher.findAll({
        where: { teacherId },
        include: [
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
              order: [['grade', 'DESC']],
            }
          }
        ]
      });

      // Array to store the formatted data
      const formattedResult = [];

      // Looping through activeAssignedTeachers and creating promises to fetch subjects
      for (const data of activeAssignedTeachers) {
        const assignedSubjects = await AssignedSubject.findAll({
          where: { assignedTeacherId: data.id },
          attributes: [], // not interested in any attributes
          order: [['createdAt', 'DESC']],
          include: {
            model: Subject,
            attributes: ['id', 'name'],
          }
        });

        // Check if the class ID already exists in the formatted result
        const existingClassIndex = formattedResult.findIndex(item => item.classId === data.Section.Class.id);

        if (existingClassIndex !== -1) {
          // If the class ID exists, push the section to its sections array
          formattedResult[existingClassIndex].classes.push({
            classId: data.Section.Class.id,
            sections: [{
              id: data.Section.id,
              name: data.Section.name,
              capacity: data.Section.capacity,
              subjects: assignedSubjects,
            }]
          });
        } else {
          // If the class ID doesn't exist, add the class and its section to the formatted result
          formattedResult.push({
            id: data.id,
            teacherId: data.teacherId,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            teacher: `${data.User.firstName} ${data.User.lastName}`,
            classes: [{
              classId: data.Section.Class.id,
              class: data.Section.Class,
              sections: [{
                id: data.Section.id,
                name: data.Section.name,
                capacity: data.Section.capacity,
                subjects: assignedSubjects,
              }]
            }],
          });
        }
      }

      return res.status(200).json({ "all active assigned teachers": formattedResult });
    } catch (error) {
      console.error('Error fetching active assigned teachers:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};


