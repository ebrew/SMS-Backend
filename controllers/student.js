require('dotenv').config();
const { Op, or, and, where } = require('sequelize');
const passport = require('../db/config/passport')
const { Parent, Student, ClassStudent } = require("../db/models/index");
const { normalizeGhPhone } = require('../utility/cleaning');

// Student admission
exports.admitStudent = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { student, parent, parentEmployment, emergency, classInfo } = req.body;

      if (!student || !parent || !parentEmployment || !emergency || !classInfo)
        return res.status(400).json({ message: 'Incomplete field!' });

      const { firstName, middleName, lastName, email, phone, address, dob, gender, nationality, passportPhoto } = student;
      const { parentFulltName, title, relationship, parentAddress, parentEmail, parentPhone, homePhone } = parent;
      const { occupation, employer, employerAddress, workPhone } = parentEmployment;
      const { emergencyName, emergencyTitle, emergencyAddress, emergencyPhone } = emergency;
      const { classSessionId, academicYearId } = classInfo;
      const password = process.env.DEFAULT_PASSWORD;

      // Check if parent already exists
      let parentRecord = await Parent.findOne({
        where: {
          [Op.and]: [
            { fullName: { [Op.iLike]: parentFulltName } },
            { email: normalizeGhPhone(parentPhone) }
          ]
        }
      });

      if (!parentRecord) {
        parentRecord = await Parent.create({
          firstName: parentFirstName,
          lastName: parentLastName,
          title,
          relationship,
          address: parentAddress,
          email: parentEmail,
          phone: normalizeGhPhone(parentPhone),
          homePhone,
          gender: parentGender,
          occupation,
          employer,
          employerAddress,
          workPhone,
          password
        });
      }

      // Check if student already exists
      let studentRecord = await Student.findOne({
        where: {
          [Op.and]: [
            { firstName: { [Op.iLike]: firstName } },
            { middleName: { [Op.iLike]: middleName } },
            { lastName: { [Op.iLike]: lastName } },
          ]
        }
      });

      if (studentRecord)
        return res.status(400).json({ message: 'Student already admited!' });

      studentRecord = await Student.create({
        firstName,
        middleName,
        lastName,
        email,
        phone: normalizeGhPhone(phone),
        address,
        dob,
        gender,
        nationality,
        passportPhoto,
        parentId: parentRecord.id,
        password,
        emergencyName,
        emergencyTitle,
        emergencyAddress,
        emergencyPhone
      });

      // Check if student already exists in the class
      let classRecord = await ClassStudent.findOne({
        where: {
          [Op.and]: [
            { studentId: studentRecord.id },
            { classSessionId: classSessionId },
            { academicYearId: academicYearId }
          ]
        }
      });

      if (!classRecord) {
        await ClassStudent.create({
          studentId: studentRecord.id,
          classSessionId,
          academicYearId
        });
      }

      res.status(200).json({ message: 'Student admitted successfully!' });

    } catch (error) {
      console.error('Error saving admission data:', error);
      res.status(500).json({ message: "Can't save admission data at the moment!" });
    }
  });
};

