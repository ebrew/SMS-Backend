require('dotenv').config();
const { Op, where } = require('sequelize');
const passport = require('../db/config/passport')
const { Parent, Student, ClassStudent, Section, Class, AcademicYear } = require("../db/models/index");
const { normalizeGhPhone } = require('../utility/cleaning');
const cloudinary = require('../db/config/cloudinaryConfig');

// Student admission
exports.admitStudent = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' }); 

    try {
      const { student, parent, parentEmployment, emergency, classInfo } = req.body;

      if (!student || !parent || !parentEmployment || !emergency || !classInfo)
        return res.status(400).json({ message: 'Incomplete field!' });

      const { firstName, middleName, lastName, email, phone, address, dob, gender, nationality } = student;
      const { parentFullName, title, relationship, parentAddress, parentEmail, parentPhone, homePhone } = parent;
      const { occupation, employer, employerAddress, workPhone } = parentEmployment;
      const { emergencyName, emergencyTitle, emergencyAddress, emergencyPhone } = emergency;
      const { classSessionId, academicYearId } = classInfo;
      const password = process.env.DEFAULT_PASSWORD;

      // Check if parent already exists
      let parentRecord = await Parent.findOne({
        where: {
          [Op.and]: [
            { fullName: { [Op.iLike]: parentFullName } },
            { phone: normalizeGhPhone(parentPhone) }
          ]
        }
      });

      if (!parentRecord) {
        parentRecord = await Parent.create({
          fullName: parentFullName,
          title,
          relationship,
          address: parentAddress,
          email: parentEmail,
          phone: normalizeGhPhone(parentPhone),
          homePhone: homePhone !== "" ? normalizeGhPhone(homePhone) : null,
          occupation,
          employer,
          employerAddress,
          workPhone: workPhone !== "" ? normalizeGhPhone(workPhone) : null,
          password
        });
      }

      let studentRecord = await Student.findOne({
        where: {
          [Op.and]: [
            { firstName: { [Op.iLike]: firstName } },
            { middleName: { [Op.iLike]: middleName } },
            { lastName: { [Op.iLike]: lastName } },
            { parentId: parentRecord.id }
          ]
        }
      });

      if (!studentRecord) {
        // const uphone = phone !== "" ? normalizeGhPhone(phone) : null;
        studentRecord = await Student.create({
          firstName,
          middleName,
          lastName,
          email,
          phone: phone !== "" ? normalizeGhPhone(phone) : null,
          address,
          dob,
          gender,
          nationality,
          parentId: parentRecord.id,
          password,
          emergencyName,
          emergencyTitle,
          emergencyAddress,
          emergencyPhone: emergencyPhone !== ""? normalizeGhPhone(emergencyPhone) : null
        });
      }

      // Check if class student already exists
      let classRecord = await ClassStudent.findOne({
        where: { studentId: studentRecord.id, classSessionId, academicYearId }
      });

      if (!classRecord)
        await ClassStudent.create({ studentId: studentRecord.id, classSessionId, academicYearId });

      return res.status(200).json({ message: 'Student admitted successfully!', 'studentId': studentRecord.id });

    } catch (error) {
      console.error('Error saving admission data:', error);
      res.status(500).json({ message: "Can't save admission data at the moment!" });
    }
  })(req, res);
};

// Update a student's DP url
exports.updateStudentDP = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' }); 

    try {
      const { passportPhoto } = req.body;
      const studentId = req.params.id;

      // Validate request body
      if (!passportPhoto) 
        return res.status(400).json({ message: "Passport photo is required!" });

      // Find the student by ID
      const user = await Student.findByPk(studentId);
      if (!user) 
        return res.status(404).json({ message: 'Student not found!' });

      const oldImgPublicId = user.passportPhoto?.public_id;

      // Update new DP
      user.passportPhoto = passportPhoto;
      await user.save();

      if (!oldImgPublicId) 
        return res.status(200).json({ message: 'Image updated successfully!' });

      // Delete old image from Cloudinary
      const result = await cloudinary.uploader.destroy(oldImgPublicId);

      if (result.result !== 'ok') {
        console.error('Error deleting old image from Cloudinary:', result);
        return res.status(500).json({ message: 'Error deleting old image!' });
      }

      return res.status(200).json({ message: 'Image updated successfully!' });
    } catch (error) {
      console.error('Error updating image:', error);
      return res.status(500).json({ message: 'Unable to update image at the moment!' });
    }
  }) (req, res);
};

// Get all students
exports.allStudents = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' }); 

    try {
      // Find the active academic year and update its status if necessary
      let activeAcademicYear = await AcademicYear.findOne({ where: { status: 'Active' } });
      if (activeAcademicYear) {
        await activeAcademicYear.setInactiveIfEndDateDue();
      }

      // Fetch the updated active academic year
      activeAcademicYear = await AcademicYear.findOne({ where: { status: 'Active' } });
      if (!activeAcademicYear) {
        return res.status(400).json({ message: "No active academic year available!" });
      }

      const allStudents = await Student.findAll({
        order: [['firstName', 'ASC']],
      });

      // Map through Class students and create promises to fetch classes
      const promises = allStudents.map(async (student) => {
        const classStudent = await ClassStudent.findOne({
          where: { studentId: student.id, academicYearId: activeAcademicYear.id },
          order: [['createdAt', 'DESC']],
          include: {
            model: Section,
            attributes: ['id', 'name'],
            include: {
              model: Class,
              attributes: ['id', 'name'],
            },
          },
        });

        // Check if classStudent record exists
        let classSection = 'N/A';
        if (classStudent)
          classSection = `${classStudent.Section.Class.name} (${classStudent.Section.name})`;

        // Return the formatted data along with the subjects in a class
        return {
          studentId: student.id,
          // academicYearId: activeAcademicYear.id,
          fullName: student.middleName ? `${student.firstName} ${student.middleName} ${student.lastName}`: `${student.firstName} ${student.lastName}`,
          address: student.address,
          passportPhoto: student.passportPhoto,
          classSection: classSection,
        };
      });

      // Execute all promises concurrently and await their results
      const formattedResult = await Promise.all(promises);
      return res.status(200).json({ students: formattedResult });
    } catch (error) {
      console.error('Error fetching students:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  })(req, res);
};

// Update student details
exports.updateStudentDetails = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' }); 

    try {
      const { firstName, middleName, lastName, email, phone, address, dob, gender, nationality } = req.body;
      const studentId = req.params.id;

      // Find the student by ID
      const student = await Student.findByPk(studentId);

      if (!student)
        return res.status(404).json({ message: 'Student not found!' });

      // Update student attributes
      student.firstName = firstName;
      student.lastName = lastName;
      student.middleName = middleName
      student.email = email ? email.toLowerCase() : ""
      student.phone = phone ? normalizeGhPhone(phone) : "";
      student.gender = gender;
      student.address = address;
      student.dob = dob;
      student.nationality = nationality

      // Save the updated staff
      await student.save();

      // Respond with success message
      return res.status(200).json({ message: 'Student updated successfully!' });
    } catch (error) {
      console.error('Error updating student:', error);
      return res.status(500).json({ message: 'Unable to update student at the moment!' });
    }
  })(req, res);
};

// Update student emegency contact info
exports.updateStudentEmergencyContact = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' }); 

    try {
      const { emergencyName, emergencyTitle, emergencyAddress, emergencyPhone } = req.body;
      const studentId = req.params.id;

      // Find the student by ID
      const student = await Student.findByPk(studentId);

      if (!student)
        return res.status(404).json({ message: 'Student not found!' });

      // Update student attributes
      student.emergencyName = emergencyName;
      student.emergencyTitle = emergencyTitle;
      student.emergencyAddress = emergencyAddress
      student.emergencyPhone = emergencyPhone ? normalizeGhPhone(emergencyPhone) : ""

      // Save the updated staff
      await student.save();

      // Respond with success message
      return res.status(200).json({ message: 'Student updated successfully!' });
    } catch (error) {
      console.error('Error updating student:', error);
      return res.status(500).json({ message: 'Unable to update student at the moment!' });
    }
  })(req, res);
};

// Update student's parent's info
exports.updateStudentParentDetails = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' }); 

    try {
      const { parentFullName, title, relationship, parentAddress, parentEmail, parentPhone, homePhone } = req.body;
      const parentId = req.params.id;

      // Find the parent by ID
      const parent = await Parent.findByPk(parentId);

      if (!parent)
        return res.status(404).json({ message: 'Parent not found!' });

      // Update parent attributes
      parent.fullName = parentFullName;
      parent.title = title;
      parent.relationship = relationship
      parent.address = parentAddress
      parent.email = parentEmail ? parentEmail.toLowerCase() : ""
      parent.phone = parentPhone ? normalizeGhPhone(parentPhone) : "";
      parent.homePhone = homePhone ? normalizeGhPhone(homePhone) : "";

      // Save the updated staff
      await parent.save();

      // Respond with success message
      return res.status(200).json({ message: 'Parent updated successfully!' });
    } catch (error) {
      console.error('Error updating parent:', error);
      return res.status(500).json({ message: 'Unable to update parent record at the moment!' });
    }
  })(req, res);
};

// Update student's parent's employment info
exports.updateParentEmployment = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' }); 

    try {
      const { occupation, employer, employerAddress, workPhone } = req.body;
      const parentId = req.params.id;

      // Find the parent by ID
      const parent = await Parent.findByPk(parentId);

      if (!parent)
        return res.status(404).json({ message: 'Parent not found!' });

      // Update parent attributes
      parent.occupation = occupation;
      parent.employer = employer;
      parent.employerAddress = employerAddress
      parent.workPhone = workPhone ? normalizeGhPhone(workPhone) : "";

      // Save the updated staff
      await parent.save();

      // Respond with success message
      return res.status(200).json({ message: 'Parent updated successfully!' });
    } catch (error) {
      console.error('Error updating parent:', error);
      return res.status(500).json({ message: 'Unable to update parent record at the moment!' });
    }
  })(req, res);
};

// Update student's class
exports.updateStudentClass = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' }); 

    try {
      const { classSessionId } = req.body;
      const { assignedClassId } = req.params; 

      // Find the student class by ID
      const studentClass = await ClassStudent.findByPk(assignedClassId);

      if (!studentClass) {
        return res.status(404).json({ message: 'Class section not found!' });
      }

      // Update class
      studentClass.classSessionId = classSessionId;
      await studentClass.save();

      // Respond with success message
      return res.status(200).json({ message: 'Class updated successfully!' });
    } catch (error) {
      console.error('Error updating class:', error);
      return res.status(500).json({ message: 'Unable to update class record at the moment!' });
    }
  })(req, res);
};

// Fetch academic year classSession students
exports.classStudents = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' }); 

    try {
      const { academicYearId, classSessionId } = req.params;
      const section = await Section.findByPk(classSessionId);
      const academicYear = await AcademicYear.findByPk(academicYearId);

      if (!section) return res.status(400).json({ message: "Class section not found!" });
      if (!academicYear) return res.status(400).json({ message: "Academic year not found!" });

      // Fetching class students
      const students = await ClassStudent.findAll({
        where: {
          classSessionId,
          academicYearId
        },
        include: {
          model: Student,
          attributes: ['id', 'firstName', 'middleName', 'lastName', 'passportPhoto'],
        }
      });

      // Map through Class students and create promises to fetch classes
      const promises = students.map(async (classStudent) => {
        const student = classStudent.Student; // Access the related Student model

        // Return the formatted data along with the subjects in a class
        return {
          studentId: student.id,
          fullName: student.middleName
            ? `${student.firstName} ${student.middleName} ${student.lastName}`
            : `${student.firstName} ${student.lastName}`,
          passportPhoto: student.passportPhoto,
          status: ClassStudent.status
        };
      });

      // Execute all promises concurrently and await their results
      const formattedResult = await Promise.all(promises);
      return res.status(200).json({ students: formattedResult });
    } catch (error) {
      console.error('Error fetching students:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  })(req, res);
};
