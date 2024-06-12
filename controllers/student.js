require('dotenv').config();
const { Op, or, and, where } = require('sequelize');
const passport = require('../db/config/passport')
const { Parent, Student, ClassStudent, Section, Class, AcademicYear } = require("../db/models/index");
const { normalizeGhPhone } = require('../utility/cleaning');
const cloudinary = require('../db/config/cloudinaryConfig');

// Student admission
exports.admitStudent = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

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
          homePhone,
          occupation,
          employer,
          employerAddress,
          workPhone,
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
        const uphone = phone !== "" ? normalizeGhPhone(phone) : null;
        studentRecord = await Student.create({
          firstName,
          middleName,
          lastName,
          email,
          phone: uphone,
          address,
          dob,
          gender,
          nationality,
          parentId: parentRecord.id,
          password,
          emergencyName,
          emergencyTitle,
          emergencyAddress,
          emergencyPhone
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
  });
};

// Update a student's DP url
exports.updateStudentDP = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const { url } = req.body;
      const studentId = req.params.id;

      // Validate request body
      if (!url) {
        return res.status(400).json({ message: "Image's url is required!" });
      }

      // Find the student by ID
      const user = await Student.findByPk(studentId);

      if (!user) {
        return res.status(404).json({ message: 'Student not found!' });
      }

      const oldImgPublicId = JSON.parse(user.passportPhoto)?.public_id;

      // if (oldURL === url) {
      //   return res.status(400).json({ message: "The existing and updated images are identical!" });
      // }

      // Update new DP
      user.passportPhoto = url;
      await user.save();

      if(!oldImgPublicId)
        return res.status(200).json({ message: 'Image updated successfully!' });

      // Extract the public ID from the current URL
      // const publicId = oldURL.split('/').pop().split('.')[0];

      // Delete old image from Cloudinary
      const result = await cloudinary.uploader.destroy(oldImgPublicId);

      if (result.result !== 'ok') {
        console.error('Error deleting old image from Cloudinary:', result);
        return res.status(500).json({ message: 'Error deleting old image!', 'OldImageURL': oldURL });
      }

    } catch (error) {
      console.error('Error updating image:', error);
      return res.status(500).json({ message: 'Unable to update image at the moment!' });
    }
  });
};

// Get all students
exports.allStudents = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

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
  });
};

// Get a particular student's detailed info
exports.studentDetails = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

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
  });
};
