require('dotenv').config();
const { Op, or, and, where } = require('sequelize');
const passport = require('../db/config/passport')
const { Parent, Student, ClassStudent } = require("../db/models/index");
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

      const { firstName, middleName, lastName, email, phone, address, dob, gender, nationality, passportPhoto } = student;
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

      // Check if student already exists
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

      // if (studentRecord)
      //   return res.status(400).json({ message: 'Student record already exists!' });

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
        passportPhoto,
        parentId: parentRecord.id,
        password,
        emergencyName,
        emergencyTitle,
        emergencyAddress,
        emergencyPhone
      });

      // Check if class student already exists
      let classRecord = await ClassStudent.findOne({
        where: { studentId:studentRecord.id, classSessionId, academicYearId }
      });

      if(!classRecord)
        await ClassStudent.create({ studentId: studentRecord.id, classSessionId, academicYearId });

      return res.status(200).json({ message: 'Student admitted successfully!' });

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
      if (!url) 
        return res.status(400).json({ message: "Image's url is required!" });

      // Find the student by ID
      const user = await Student.findByPk(studentId);

      if (!user)
        return res.status(404).json({ message: 'Student not found!' });

      // Check if image url exists
      if (user.passportPhoto) {
        if (user.passportPhoto === url)
          return res.status(400).json({ message: "The existing and updated images are identical!" })
      
        // Extract the public ID from the current URL
        const publicId = user.passportPhoto.split('/').pop().split('.')[0];

        // Delete old image from Cloudinary
        await cloudinary.uploader.destroy(publicId, (error, result) => {
          if (error) {
            console.error('Error deleting old image from Cloudinary:', error);
            return res.status(500).json({ message: 'Error deleting old image!' });
          }
        });
      }

      //  update new DP
      user.passportPhoto = url
      await user.save();
      return res.status(200).json({ message: 'Image updated successfully!' });
    } catch (error) {
      console.error('Error updating image:', error);
      return res.status(500).json({ message: 'Unable to update image at the moment!' });
    }
  });
};

// Get all students
exports.allStudents = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const all = await Student.findAll({
        order: [['firstName', 'ASC']],
        attributes: ['id', 'firstName', 'middleName', 'lastName', 'role', 'email', 'phone', 'address', 'dob', 'gender', 'nationality', 'passportPhoto'], 
        include: {
          model: Parent, 
          attributes: ['id', 'title', 'fullName', 'relationship', 'address', 'email']
        },
      })
      return res.status(200).json({ 'students': all });
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};
