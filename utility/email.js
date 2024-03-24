require('dotenv').config();
const nodemailer = require('nodemailer');
const { Op, or, and } = require('sequelize');
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
exports.sendPasswordResetSucessEmail = async (userEmail, salutation, message) => {
  mailOptions = {
    from: process.env.EMAIL,
    to: userEmail,
    subject: 'Password Reset',
    html: `
      <p>Hello ${salutation},</p>
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
exports.sendRequestMailToAdmin = async (userEmail, link, message, salutation) => {
  mailOptions = {
    from: process.env.EMAIL,
    to: userEmail,
    subject: 'Password Reset Request',
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

// this is sent to teacher for being assigned to classes with subjects
exports.classAssignmentPromptEmail = async (userEmail, salutation, message) => {
  mailOptions = {
    from: process.env.EMAIL,
    to: userEmail,
    subject: 'Class/Subjects Assignment',
    html: `
      <p>Hello ${salutation},</p>
      <p>${message}</p>
      <p>Click the link below to login for more details of the classes or subjects you're assigned to: </p>
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

// Forgot Password
exports.forgotPassword = async (req, res) => {
  const { userID } = req.body;
  
  if(!userID)
      return res.status(400).json({message: 'Email/Username/Phone is required!'});

  const user = await User.findOne({
      where: {
          [Op.or]: [
              { userName: userID },
              { email: userID },
              { phone: normalizeGhPhone(userID)}, 
          ],
      },
  }).catch((err) => {
      console.log('Error:', err);
  });

  if(!user)
      return res.status(400).json({message: 'Staff not found!'});
  
  const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const resetTokenExpiration = Date.now() + 3600000; // Token valid for 1 hour

  user.resetToken = resetToken;
  user.resetTokenExpiration = resetTokenExpiration;
  await user.save();

  // Send reset email
  Utility.sendPasswordResetEmail(user.email, resetToken);
    
}

// Resetting password with an email link
exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  if(!newPassword)
      return res.status(400).json({message: 'Your new password is required!'});

  const user = await User.findOne({ where: { resetToken: token, resetTokenExpiration: { [Op.gt]: Date.now() } } });
    
  if (!user)
    return res.status(400).json({ message: 'Invalid or expired token.' });

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  user.resetToken = null;
  user.resetTokenExpiration = null;
  
  const savedUser = await user.save().catch((err) => {
    console.log('Error:', err);
    res.json({error: 'Cannot reset at the moment!'});
  })

  if(savedUser) res.status(200).json({message: 'Password reset successful'});   
};

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