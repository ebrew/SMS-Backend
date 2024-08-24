require('dotenv').config();
const nodemailer = require('nodemailer');
const { Op } = require('sequelize');
const {User} = require("../db/models/index")

// Create a nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',  
  auth: {
    user: process.env.EMAIL,  
    pass: process.env.EMAIL_PASSWORD,  
  },
});

// this is sent to user after Admin has rest the password
const sendPasswordResetSucessEmail = async (userEmail, salutation, message) => {
  mailOptions = {
    from: process.env.EMAIL,
    to: userEmail,
    subject: 'Password Reset',
    html: `
      <p>${salutation}</p>
      <p>Your password has been reset by your Admin.</p>
      <p>${message}</p>
      <a href="${process.env.FRONTEND_URL}">Login</a>
      <p>Temporary Password: ${process.env.DEFAULT_PASSWORD}</p>
      <p>If you didn't request a password reset or you are not the intended recipient, please ignore this email. Acting on it may cause a severe action to be taken against you!!!</p>
    `,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.error(error);
        // When email fails
        return false;
      }
  });
} 

// this is to prompt Admins with a link to reset user's password to default
const sendRequestMailToAdmin = async (userEmail, link, message, salutation) => {
  mailOptions = {
    from: process.env.EMAIL,
    to: userEmail,
    subject: 'Password Reset Request',
    // Latif has to redirect if mail link is used
    html: `
      <p>${salutation}</p>
      <p>${message}</p>
      <a href="${link}">Reset Password</a>
      <p> </p>
      <a href="${process.env.FRONTEND_URL}">Login</a>
      <p>If you are not the intended recipient, please ignore this email. Acting on it may cause a severe action to be taken against you!!!</p>
    `,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.error(error);
        // When email fails
        return false;
      }
  });
} 

// when user needs to reset his/her own password with a link
exports.sendPasswordResetEmail = async (userEmail, resetToken) => {
  const mailOptions = {
    from: process.env.EMAIL,
    to: userEmail,
    subject: 'Password Reset',
    html: `
      <p>Hello,</p>
      <p>We received a request to reset your password. Click the link below to reset your password:</p>
      <a href="${process.env.APP_URL}/reset-password/${resetToken}">Reset Password</a>
      <p>If you didn't request a password reset, please ignore this email.</p>
    `,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to send reset email.' });
    }
    res.status(200).json({ message: 'Reset email sent.' });
  });
} 

module.exports = {
  transporter,
  sendPasswordResetSucessEmail,
  sendRequestMailToAdmin,
};