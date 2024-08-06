require('dotenv').config();
const db = require("../db/models/index")
const { transporter } = require('../utility/email');
const generateResultsPDF = require('../utility/generateResultPDF');
const fs = require('fs');
const { fetchClassResults } = require('./result');
const passport = require('../db/config/passport')

// Forward list of students results to parent for a particular academic term
exports.sendStudentResultsToParent = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });

    let { studentIds, classSessionId, academicTermId, academicYearId } = req.body;
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

          const fullName = student.middleName
          ? `${student.firstName} ${student.middleName} ${student.lastName}`
          : `${student.firstName} ${student.lastName}`
          const parentName = student.Parent.title
            ? `Dear ${student.Parent.title} ${student.Parent.fullName},\n\nAttached are the results for ${fullName}.\n\nBest regards,\nSchool Management System`
            : `Dear ${student.Parent.fullName},\n\nAttached are the results for ${fullName}.\n\nBest regards,\nSchool Management System`;

          // Generate the PDF for the student result
          const pdfPath = await generateResultsPDF({
            ...studentResult,
            academicYear: academicYearId,
            academicTerm: academicTermId,
            classSession: classSessionId,
            fullName: fullName,
            photo: student.photo
          });

          // Prepare email options
          const mailOptions = {
            from: process.env.EMAIL,
            to: student.Parent.email,
            subject: `Results for ${fullName}`,
            text: parentName,
            attachments: [
              {
                filename: `${fullName.replace(/ /g, '_')}_results.pdf`,
                path: pdfPath,
                contentType: 'application/pdf'
              }
            ]
          };

          // Send the email with the PDF attachment
          await transporter.sendMail(mailOptions);

          // Clean up the temporary file
          fs.unlinkSync(pdfPath);

          results.push({ studentId, studentResult, status: 'Results sent successfully' });
        } catch (error) {
          console.error(`Error sending results for studentId ${studentId}:`, error);
          results.push({ studentId, status: `Error: ${error.message}` });
        }
      }));

      return res.status(200).json(results);

    } catch (error) {
      console.error('Error processing request:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};



