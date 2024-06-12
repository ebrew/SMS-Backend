require('dotenv').config();
var express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op, or, and } = require('sequelize');
const passport = require('../db/config/passport')
const { User, Student, Parent, Class, Section, ResetRequest, Department, AssignedTeacher, ClassStudent, AcademicYear } = require("../db/models/index")
const Mail = require('../utility/email');
const sendSMS = require('../utility/sendSMS');
const { normalizeGhPhone, extractIdAndRoleFromToken } = require('../utility/cleaning');


// Staff Login
exports.login = async (req, res) => {
  try {
    const { userID, password } = req.body;

    if (!userID || !password)
      return res.status(400).json({ message: 'Incomplete fields!' });

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { userName: userID },
          { email: userID.toLowerCase() },
          { phone: normalizeGhPhone(userID) },
        ],
      },
    })

    if (!user)
      return res.status(400).json({ message: 'Staff not found!' });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      return res.status(400).json({ message: 'Invalid Credentials!' });

    const token = jwt.sign({ id: user.id, firstName: user.firstName, lastName: user.lastName, role: user.role }, process.env.SECRET_KEY, { expiresIn: '1h' });

    // let oldTokens = user.tokens || [];
    // if (oldTokens.length) {
    //   oldTokens = oldTokens.filter(t => {
    //     const tokenCreationTime = parseInt(t.signedAt);
    //     const currentTime = Date.now();
    //     const timeDiff = (currentTime - tokenCreationTime) / 1000; // Difference in seconds
    //     return timeDiff < 3600; // Filter out tokens created within the last hour
    //   });
    // }

    // // Update the user document with the new tokens (filtered old tokens + new token)
    // await User.update(
    //   { tokens: [...oldTokens, { token, signedAt: Date.now().toString() }] },
    //   { where: { id: user.id } }
    // );

    return res.status(200).json({ message: 'Logged in successfully!', "isPasswordReset": user.isPasswordReset, "token": token });
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({ message: "Can't login at the moment!" });
  }
}

// Staff Registration
exports.register = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { userName, firstName, lastName, email, phone, role, staffID, gender, departmentId, address } = req.body;

      if (!userName || !firstName || !lastName || !role || !email || !phone || !gender)
        return res.status(400).json({ message: 'Incomplete fields!' });

      const uPhone = normalizeGhPhone(phone)
      const alreadyExist = await User.findOne({
        where: {
          [Op.or]: [
            { userName: userName },
            { email: email.toLowerCase() },
            { phone: uPhone },
          ],
        },
      })


      if (alreadyExist)
        return res.status(400).json({ message: 'Staff already exist!' });

      const password = process.env.DEFAULT_PASSWORD;
      const newStaff = new User({ userName, firstName, lastName, email, phone: uPhone, role, staffID, gender, password, departmentId, address });
      await newStaff.save()
      return res.status(200).json({ message: 'Staff created successfully!' });
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ message: 'Cannot register at the moment!' });
    }
  })
}

// Get a particular teacher's or student details
exports.getUser = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { id, role } = req.params;

      // const ModelToUse = role === 'Student' ? Student : User;

      if (role === 'Student') {
        let activeAcademicYear = await AcademicYear.findOne({ where: { status: 'Active' } });
        if (activeAcademicYear)
          await activeAcademicYear.setInactiveIfEndDateDue();
        const academicYearId = await AcademicYear.findOne({ where: { status: 'Active' } }).id;

        // Find the student by ID
        const student = await Student.findOne({
          where: { id },
          include: {
            model: Parent,
            attributes: ['id', 'fullName', 'title', 'relationship', 'email', 'phone', 'address', 'homePhone', 'occupation', 'employer', 'employerAddress', 'workPhone']
          },
        })
        const classStudent = await ClassStudent.findOne({
          where: { studentId: id, academicYearId },
          include: {
            model: Section,
            attributes: ['id', 'name'],
            include: {
              model: Class,
              attributes: ['id', 'name'],
            },
          },
        })

        const formattedResult = {
          studentId: id,
          parent: student.parent,
          student: student,
          assignedClassId: classStudent.id,
          classSection: `${classStudent.Section.Class.name} (${classStudent.Section.name})`
        };
        return res.status(200).json({ student: formattedResult });
      } else {
        const user = await User.findOne({
          where: { id },
          attributes: ['id', 'userName', 'firstName', 'lastName', 'role', 'email', 'phone', 'address', 'staffID', 'dob'],
        })
        return res.status(200).json({ 'user': user });
      }
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Update an existing staff
exports.updateStaff = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const { userName, firstName, lastName, email, phone, role, staffID, gender, departmentId, address, dob } = req.body;
      const staffId = req.params.id;

      // Validate request body
      if (!userName || !firstName || !lastName || !role || !email || !phone || !gender)
        return res.status(400).json({ message: 'Important fields cannot be left blank!' });

      // Find the staff by ID
      const user = await User.findByPk(staffId);

      if (!user)
        return res.status(404).json({ message: 'Staff not found!' });

      // Check if the selected department exists
      if (departmentId && departmentId !== 0) {
        const isDepartmentExist = await Department.findByPk(departmentId);

        if (!isDepartmentExist) {
          return res.status(400).json({ message: `Selected department doesn't exist!` });
        }
      }

      // Update staff attributes
      user.userName = userName;
      user.firstName = firstName;
      user.lastName = lastName;
      user.email = email.toLowerCase();
      user.phone = normalizeGhPhone(phone);
      user.role = role;
      user.staffID = staffID;
      user.gender = gender;
      user.departmentId = departmentId === 0 ? null : departmentId;
      user.address = address;
      user.dob = dob;

      // Save the updated staff
      await user.save();

      // Respond with success message
      return res.status(200).json({ message: 'Staff updated successfully!' });
    } catch (error) {
      console.error('Error updating staff:', error);
      return res.status(500).json({ message: 'Unable to update staff at the moment!' });
    }
  });
};

// Deleting an existing staff
exports.deleteStaff = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const staffId = req.params.id;

      // Check if a class is assigned to the staff
      const assignment = await AssignedTeacher.findOne({ where: { teacherId: staffId } });

      if (assignment)
        return res.status(400).json({ message: 'Cannot delete staff as the staff has been assigned to one or more classes!' });

      // If no assignments, proceed to delete 
      const result = await User.destroy({ where: { id: staffId } });

      if (result === 0)
        return res.status(400).json({ message: 'Staff not found!' });

      return res.status(200).json({ message: 'Staff deleted successfully!' });
    } catch (error) {
      console.error('Error deleting subject:', error);
      return res.status(500).json({ message: 'Cannot delete staff at the moment' });
    }
  });
};

// Reset staff account DEFAULT PASSWORD after account creation
exports.defaultReset = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const userId = req.user.id;
      const { password } = req.body;

      if (!password)
        return res.status(400).json({ message: 'New password is required' });

      const user = await User.findOne({ where: { id: userId } });

      if (!user)
        return res.status(400).json({ message: 'Invalid credentials!' });

      if (password === process.env.DEFAULT_PASSWORD)
        return res.status(400).json({ message: "You must use a new password!" });

      const token = jwt.sign({ id: user.id, firstName: user.firstName, lastName: user.lastName, role: user.role }, process.env.SECRET_KEY, { expiresIn: '1h' });
      user.password = await bcrypt.hash(password, 10);
      user.isPasswordReset = true;
      await user.save();
      return res.status(200).json({ message: 'Password reset successfully!', "isPasswordReset": user.isPasswordReset, "token": token });
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ message: 'Cannot reset password at the moment!' });
    }
  });
};

// Request Password Reset from Admin
exports.passwordResetRequest = async (req, res) => {
  try {
    const { userID } = req.body;

    if (!userID)
      return res.status(400).json({ message: 'Email/Username/Phone number is required! to send a request!' });

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { userName: userID },
          { email: userID.toLowerCase() },
          { phone: normalizeGhPhone(userID) },
        ],
      }
    })

    if (!user)
      return res.status(400).json({ message: 'Staff not found!' });

    // Check if user has requested before
    const validRequest = await ResetRequest.findOne({ where: { userId: user.id } });
    if (validRequest) {
      // Check if request already exit or it's pending
      if (validRequest.isPasswordReset === false)
        return res.status(400).json({ message: 'Password reset already requested, Admin will soon act on it!' });

      // Rerequesting reset  
      validRequest.isPasswordReset = false;
      await validRequest.save();
    } else {
      // First time requester
      const newRequest = new ResetRequest({ userId: user.id });
      await newRequest.save();
    }

    // Find Admins with non-null emails
    const adminsWithEmails = await User.findAll({
      where: {
        role: 'Admin',
        email: { [Op.not]: null }
      },
      // Only fetch the email field
      attributes: ['email', 'gender', 'firstName'],
    });

    // Extract emails from the result as a list/array
    const emails = adminsWithEmails.map(admin => admin.email);

    // when admin does not have email to be prompted
    if (emails.length === 0)
      return res.status(200).json({ message: "Request sent! Admin will act soon!" });

    // token generation for the requester
    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const resetTokenExpiration = Date.now() + 3600000; // Token valid for 1 hour

    user.resetTokenExpiration = resetTokenExpiration;
    user.resetToken = resetToken;
    await user.save();

    // Proceed with sending emails
    for (const email of emails) {
      const admin = adminsWithEmails.find(admin => admin.email === email);
      const male_gender = admin.gender === 'Male';
      const salutation = male_gender ? `Hello Sir ${admin.firstName},` : `Hello Madam ${admin.firstName},`;

      let message;
      if (male_gender) {
        message = `Sir ${user.firstName} ${user.lastName} with ${user.role} role is humbly requesting you to reset his password. Click the link below to reset his password or log in to reset:`;
      } else {
        message = `Madam ${user.firstName} ${user.lastName} with ${user.role} role is humbly requesting you to reset her password. Click the link below to reset her password or log in to reset:`;
      }

      // Latif has to redirect if mail link is used
      const link = `${process.env.APP_URL}/staff/admin-reset-password/${resetToken}`;
      const send = await Mail.sendRequestMailToAdmin(email, link, message, salutation);

      // if (!send)
      //   return res.status(200).json({ message: "Request sent but email notification failed! Admin will act soon!" });
    }

    return res.status(200).json({ message: "Request sent! Admin will act soon!" });
  } catch (error) {
    console.log('Error:', error);
    return res.status(500).json({ message: 'Cannot send request to Admin at the moment!' });
  }
}

// Admin resetting password with email link request or from Admin requests' list
exports.adminResetPassword = async (req, res) => {
  try {
    //  resetToken or "id:1, role:'Admin'"
    const token = req.params.token;

    const { id, role } = extractIdAndRoleFromToken(token) || { id: null, role: null };

    console.log(id, role, token)

    // find the user requesting password reset
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { id: id, role: role },
          { resetToken: token, resetTokenExpiration: { [Op.gt]: Date.now() } }
        ],
      },
    });

    const student = await Student.findOne({
      where: {
        [Op.or]: [
          { id: id, role: role },
          { resetToken: token, resetTokenExpiration: { [Op.gt]: Date.now() } }
        ],
      },
    });

    if (!user && !student)
      return res.status(400).json({ message: 'Invalid username or expired token!' });

    if (user) {

      // Check if request has been attended to or it's pending
      const validRequest = await ResetRequest.findOne({ where: { userId: user.id } });
      if (!validRequest)
        return res.status(400).json({ message: 'No request placed for password reset!' });

      // Check if request has been attended to by admin using a link
      if (validRequest.isPasswordReset === true)
        return res.status(400).json({ message: 'Password has already been reset by an Admin!' });

      // Resetting user password
      user.password = await bcrypt.hash(process.env.DEFAULT_PASSWORD, 10); // Use await
      user.isPasswordReset = false;
      user.resetToken = null;
      user.resetTokenExpiration = null;
      validRequest.isPasswordReset = true;
      await user.save();
      await validRequest.save();

      if (user.email === null)
        return res.status(200).json({ message: 'Password reset successfully' });

      const message = `Click the link below to login and reset your own password:`;
      const salutation = user.gender === 'Male' ? `Hello Sir ${user.firstName},` : `Hello Madam ${user.firstName},`;
      const send = await Mail.sendPasswordResetSucessEmail(user.email, salutation, message);
      if (send === false)
        return res.status(200).json({ message: 'Password reset successfully' });

      return res.status(200).json({ message: 'Password reset successfully, mail notification sent' });
    } else {
      // Check if request has been attended to or it's pending
      const validRequest = await ResetRequest.findOne({ where: { studentId: student.id } });
      if (!validRequest)
        return res.status(400).json({ message: 'No request placed for password reset!' });

      // Check if request has been attended to by admin using a link
      if (validRequest.isPasswordReset === true)
        return res.status(400).json({ message: 'Password has already been reset by an Admin!' });
      // Resetting user password
      student.password = await bcrypt.hash(process.env.DEFAULT_PASSWORD, 10);
      student.isPasswordReset = false;
      student.resetToken = null;
      student.resetTokenExpiration = null;
      validRequest.isPasswordReset = true;
      await student.save();
      await validRequest.save();

      if (!user.email)
        return res.status(200).json({ message: 'Password reset successfully' });

      const message = `Click the link below to login and reset your own password:`;
      const salutation = `Hello ${student.firstName},`
      const send = await Mail.sendPasswordResetSucessEmail(user.email, salutation, message);
      // if (send === false)
      //   return res.status(200).json({ message: "Request sent but email notification failed! Admin will act soon!" });

      return res.status(200).json({ message: 'Password reset successfully!' });
    }
  } catch (error) {
    return res.status(400).json({ message: 'Cannot reset password at the moment!' });
  }
};

// List of pending Password reset requests
exports.pendingResetRequest = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const pending = await ResetRequest.findAll({
        where: { isPasswordReset: false },
        attributes: ['updatedAt'],
        order: [['updatedAt', 'ASC']],
        include: [
          {
            model: User,
            attributes: ['id', 'userName', 'firstName', 'lastName', 'role'],
          },
          {
            model: Student,
            attributes: ['id', 'userName', 'firstName', 'lastName', 'role'],
          },
        ],
      })

      // Mapping the result to the desired format
      const formattedResult = pending.map(data => {
        let student = data.Student ? true : false;
        if (student)
          return {
            updatedAt: data.updatedAt,
            id: data.Student.id,
            userName: data.Student.userName,
            firstName: data.Studentr.firstName,
            lastName: data.Student.lastName,
            role: data.Student.role
          }
        return {
          updatedAt: data.updatedAt,
          id: data.User.id,
          userName: data.User.userName,
          firstName: data.User.firstName,
          lastName: data.User.lastName,
          role: data.User.role
        }
      })

      res.status(200).json({ 'pending requests': formattedResult });
    } catch (error) {
      console.error('Error fetching resetRequests:', error);
      return res.status(500).json({ error: 'Sorry, request failed!' })
    }
  })
};

// Get all staff
exports.allStaff = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const staff = await User.findAll({
        order: [['firstName', 'ASC']],
        attributes: ['id', 'userName', 'firstName', 'lastName', 'role', 'email', 'phone', 'address', 'staffID', 'dob'],
      })
      return res.status(200).json({ 'staff': staff });
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });

};

// Developer registering Admin
exports.devAddAdmin = async (req, res) => {
  try {
    const { userName, firstName, lastName, email, phone, gender } = req.body;

    if (!userName || !firstName || !lastName || !email || !phone || !gender)
      return res.status(400).json({ message: 'Incomplete fields!' });

    const uPhone = normalizeGhPhone(phone)
    const alreadyExist = await User.findOne({
      where: {
        [Op.or]: [
          { userName: userName },
          { email: email.toLowerCase() },
          { phone: uPhone },
        ],
      },
    })


    if (alreadyExist)
      return res.status(400).json({ message: 'Admin already exist!' });

    const password = process.env.DEFAULT_PASSWORD;
    const newStaff = new User({ userName, firstName, lastName, email, phone: uPhone, role: 'Admin', gender, password });
    await newStaff.save()
    return res.status(200).json({ message: 'Admin created successfully!' });
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({ message: 'Cannot create Admin at the moment!' });
  }
}

