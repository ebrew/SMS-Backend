require('dotenv').config();
const db = require("../db/models/index")
const { transporter } = require('../utility/email');
const { generateResultsPDF, generateFeesPDF } = require('../utility/generatePDF');
const fs = require('fs');
const { fetchClassResults } = require('./result');
const { fetchSingleStudentBill } = require('./billing');
const passport = require('../db/config/passport')
const Bottleneck = require('bottleneck');
const axios = require('axios');


const limiter = new Bottleneck({
  maxConcurrent: 5,
  minTime: 1000 // Minimum time between requests (in milliseconds)
});

// Forward list of students results to parent for a particular academic term
exports.sendStudentResultsToParent = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' });

    let { studentIds, classSessionId, academicTermId } = req.body;
    const results = [];

    try {
      // Parse IDs as integers
      studentIds = studentIds.map(id => parseInt(id, 10));

      // Fetch the class results first
      const classResults = await fetchClassResults(academicTermId, classSessionId);

      if (!classResults) return res.status(400).json({ message: "Class results not found!" });

      // Fetch all required student and parent data in a single query
      const students = await db.Student.findAll({
        where: { id: studentIds },
        include: {
          model: db.Parent,
          as: 'Parent',
          attributes: ['email', 'fullName', 'title']
        }
      });

      // Process each student in parallel
      await Promise.all(studentIds.map(async (studentId) => {
        try {
          const studentResult = classResults.classStudents.find(student => student.studentId == studentId);
          const student = students.find(s => s.id === studentId);

          if (!student) {
            results.push({ studentId, status: 'Student not found' });
            return;
          }

          if (!studentResult) {
            results.push({ studentId, status: "Student result not found!" });
            return;
          }

          const parentName = student.Parent.title
            ? `Dear ${student.Parent.title} ${student.Parent.fullName},\n\nAttached are the results for your ward, ${studentResult.fullName}.\n\nBest regards,\nSchool Management System`
            : `Dear ${student.Parent.fullName},\n\nAttached are the results for your ward, ${studentResult.fullName}.\n\nBest regards,\nSchool Management System`;

          // Generate the PDF for the student result
          const pdfPath = await generateResultsPDF(studentResult);

          // Prepare email options
          const mailOptions = {
            from: process.env.EMAIL,
            to: student.Parent.email,
            subject: `Results for ${studentResult.fullName || 'Student'}`,
            text: parentName,
            attachments: [
              {
                filename: `${(studentResult.fullName || 'Student').replace(/ /g, '_')}_results.pdf`,
                path: pdfPath,
                contentType: 'application/pdf'
              }
            ]
          };

          // Send the email with the PDF attachment
          await limiter.schedule(() => transporter.sendMail(mailOptions));

          // Clean up the temporary file
          fs.unlinkSync(pdfPath);

          results.push({ studentId, status: 'Results sent successfully' });
        } catch (error) {
          console.error(`Error sending results for studentId ${studentId}:`, error);
          results.push({ studentId, status: `Error: ${error.message}` });
        }
      }));

      res.status(200).json({ message: 'Email processed successfully!', results });

    } catch (error) {
      console.error('Error processing request:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  })(req, res);
};

// Forward list of students fees to parent for a particular academic term
exports.sendStudentFeesToParent = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' });

    let { studentIds } = req.body;
    const results = [];

    try {
      // Parse IDs as integers
      studentIds = studentIds.map(id => parseInt(id, 10));

      // Fetch all required student and parent data in a single query
      const students = await db.Student.findAll({
        where: { id: studentIds },
        include: {
          model: db.Parent,
          as: 'Parent',
          attributes: ['email', 'fullName', 'title']
        }
      });

      // Process each student in parallel
      await Promise.all(studentIds.map(async (studentId) => {
        try {
          const studentFees = await fetchSingleStudentBill(studentId)
          const student = students.find(s => s.id === studentId);

          if (!student) {
            results.push({ studentId, status: 'Student not found' });
            return;
          }

          if (!studentFees) {
            results.push({ studentId, status: "Student bill not found!" });
            return;
          }

          const parentName = student.Parent.title
            ? `Dear ${student.Parent.title} ${student.Parent.fullName},\n\nAttached are the fees for your ward, ${studentFees.fullName}.\n\nBest regards,\nSchool Management System`
            : `Dear ${student.Parent.fullName},\n\nAttached are the fees for your ward, ${studentFees.fullName}.\n\nBest regards,\nSchool Management System`;

          // Generate the PDF for the student result
          const pdfPath = await generateFeesPDF(studentFees);

          // Prepare email options
          const mailOptions = {
            from: process.env.EMAIL,
            to: student.Parent.email,
            subject: `Fees for ${studentFees.fullName || 'Student'}`,
            text: parentName,
            attachments: [
              {
                filename: `${(studentFees.fullName || 'Student').replace(/ /g, '_')}_fees.pdf`,
                path: pdfPath,
                contentType: 'application/pdf'
              }
            ]
          };

          // Send the email with the PDF attachment
          await limiter.schedule(() => transporter.sendMail(mailOptions));

          // Clean up the temporary file
          fs.unlinkSync(pdfPath);

          results.push({ studentId, status: 'Fees sent successfully' });
        } catch (error) {
          console.error(`Error sending results for studentId ${studentId}:`, error);
          results.push({ studentId, status: `Error: ${error.message}` });
        }
      }));

      res.status(200).json({ message: 'Email processed successfully!', results });

    } catch (error) {
      console.error('Error processing request:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  })(req, res);
};

// Helper function for sending email
const sendEmail = async (email, studentId, subject, content) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: subject,
      text: content
    };

    await transporter.sendMail(mailOptions);
    return { studentId, status: 'Email sent successfully' };
  } catch (error) {
    console.error(`Error sending email to parent of studentId ${studentId}:`, error);
    return { studentId, status: `Error: ${error.message}` };
  }
};

// Function to send SMS using Hubtel API
const sendSMS = async (phoneNumber, message) => {
  const apiUrl = process.env.API_URL;
  const clientSecret = process.env.CLIENT_SECRET; 
  const clientId = process.env.CLIENT_ID;
  const senderId = process.env.SENDER_ID;

  if (!clientSecret || !clientId || !senderId) {
    console.error('Missing environment variables: CLIENT_SECRET, CLIENT_ID, or SENDER_ID.');
    return {  status: 'Error: Missing environment variables' };
  }

  try {
    const response = await fetch(`${apiUrl}?clientsecret=${clientSecret}&clientid=${clientId}&from=${senderId}&to=${phoneNumber}&content=${message}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const responseData = await response.json();

    if (response.ok) {
      console.log('SMS sent successfully:', responseData);
      return { status: 'SMS sent successfully' };
    } else {
      console.error('Failed to send SMS:', responseData);
      return { status: `Error: ${responseData.statusDescription || 'Unknown error'}` };
    }
  } catch (error) {
    console.error(`Error sending SMS to parent with ${phoneNumber}:`, error);
    return { status: `Error: ${error.message}` };
  }
};

// Send general reminder to parents
exports.sendReminder = async (req, res) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    if (err || !user) return res.status(401).json({ message: 'Unauthorized' });

    let { subject, classId, studentId, all, content, method } = req.body;

    if (!subject || !content || !method) return res.status(400).json({ message: 'Incomplete fields!' });

    try {
      let students = [];
      const activeAcademicYear = await db.AcademicYear.findOne({ where: { status: 'Active' } });

      if (!activeAcademicYear) return res.status(404).json({ message: 'No academic year running!' });

      if (classId) {
        classId = parseInt(classId, 10);
        if (isNaN(classId)) return res.status(400).json({ message: 'Invalid classId!' });
        students = await db.Student.findAll({
          attributes: ['id', 'parentId'],
          include: [
            {
              model: db.ClassStudent,
              where: { academicYearId: activeAcademicYear.id },
              include: [
                {
                  model: db.Section,
                  required: true, // Makes the join an INNER JOIN
                  include: [
                    {
                      model: db.Class,
                      where: { id: classId },
                      required: true, // Makes the join an INNER JOIN
                      attributes: [],
                    }
                  ],
                  attributes: [],
                }
              ],
              attributes: [],
            },
            {
              model: db.Parent,
              as: 'Parent',
              attributes: ['id', 'email', 'fullName', 'title', 'phone'],
            }
          ]
        });        
      } else if (studentId) {
        students = await db.Student.findAll({
          where: { id: studentId },
          include: {
            model: db.Parent,
            as: 'Parent',
            attributes: ['id', 'email', 'fullName', 'title', 'phone']
          },
          attributes: ['id', 'parentId']
        });
      } else if (all) {
        students = await db.Student.findAll({
          include: {
            model: db.Parent,
            as: 'Parent',
            attributes: ['id', 'email', 'fullName', 'title', 'phone']
          },
          attributes: ['id', 'parentId']
        });
      } else {
        return res.status(400).json({ message: 'Specify studentId, classId, or all!' });
      }

      if (students.length === 0) return res.status(404).json({ message: 'No students found!' });

      // Group students by parentId to ensure one message per parent
      const parentsMap = new Map();

      students.forEach(student => {
        const parent = student.Parent;
        if (parent) {
          const email = parent.email.toLowerCase();
          if (!parentsMap.has(email)) {
            parentsMap.set(email, parent);
          }
        }
      });

      const parents = Array.from(parentsMap.values());
      const results = [];

      if (method === 'Email') {
        for (const parent of parents) {
          const emailContent = parent.title
            ? `Dear ${parent.title} ${parent.fullName},\n\n${content}\n\nBest regards,\nSchool Management System`
            : `Dear ${parent.fullName},\n\n${content}\n\nBest regards,\nSchool Management System`;

          try {
            console.log(`Sending email to: ${parent.email}`);
            await limiter.schedule(() => sendEmail(parent.email, parent.id, subject, emailContent));
            console.log(`Email sent to: ${parent.email}`);
            results.push({ email: parent.email, status: 'Success' });
          } catch (error) {
            console.error(`Failed to send email to ${parent.email}:`, error);
            results.push({ email: parent.email, status: 'Failed', error: error.message });
          }
        }

        const failedResults = results.filter(result => result.status === 'Failed');
        if (failedResults.length > 0) {
          res.status(500).json({ message: 'Some emails failed to send', results: failedResults });
        } else {
          res.status(200).json({ message: 'Emails processed successfully!', results });
        }
      } else if (method === 'SMS') {
        for (const parent of parents) {
          const message = `Dear ${parent.title || ''} ${parent.fullName},\n\n${content}\n\nBest regards,\nSchool Management System`;

          try {
            console.log(`Sending SMS to: ${parent.phone}`);
            await limiter.schedule(() => sendSMS(parent.phone, message));
            console.log(`SMS sent to: ${parent.phone}`);
            results.push({ phone: parent.phone, status: 'Success' });
          } catch (error) {
            console.error(`Failed to send SMS to ${parent.phone}:`, error);
            results.push({ phone: parent.phone, status: 'Failed', error: error.message });
          }
        }

        const failedSMSResults = results.filter(result => result.status === 'Failed');
        if (failedSMSResults.length > 0) {
          res.status(500).json({ message: 'Some SMS messages failed to send', results: failedSMSResults });
        } else {
          res.status(200).json({ message: 'SMS sent successfully!', results });
        }
      } else {
        return res.status(400).json({ message: 'Specify the medium of sending the reminder!' });
      }
    } catch (error) {
      console.error('Error processing reminder:', error);
      return res.status(500).json({ message: "Can't process the reminder at the moment!" });
    }
  })(req, res);
};















