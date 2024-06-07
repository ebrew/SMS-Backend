require('dotenv').config();
var express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op, or, and } = require('sequelize');
const passport = require('../db/config/passport')
const { User, Student, ResetRequest } = require("../db/models/index")
const Mail = require('../utility/email');
const sendSMS = require('../utility/sendSMS');
const { normalizeGhPhone, extractIdAndRoleFromToken } = require('../utility/cleaning');


// Get all teachers
exports.allTeachers = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const teachers = await User.findAll({
        where: { role: 'Teacher' },
        order: [['firstName', 'ASC']],
        attributes: ['id', 'userName', 'firstName', 'lastName', 'role', 'email', 'phone', 'address', 'staffID', 'dob'],
      })
      return res.status(200).json({ 'teachers': teachers });
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

