const PDFDocument = require('pdfkit');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

const generateResultsPDF = async (studentResult) => {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument();
    const fullName = studentResult.fullName || 'Student';
    const filePath = path.join('/tmp', `${fullName.replace(/ /g, '_')}_results.pdf`);

    // Pipe the PDF into a file
    doc.pipe(fs.createWriteStream(filePath));

    // Add headers
    doc.fontSize(20).text('Student Results', { align: 'center' });
    doc.fontSize(16).text(`Academic Year: ${studentResult.academicYear}`, { align: 'center' });
    doc.fontSize(16).text(`Academic Term: ${studentResult.academicTerm}`, { align: 'center' });
    doc.fontSize(16).text(`Class: ${studentResult.classSession}`, { align: 'center' });
    doc.fontSize(16).text(`Student Name: ${fullName}`, { align: 'center' });

    // Add student photo
    if (studentResult.photo && studentResult.photo.url) {
      try {
        const response = await axios.get(studentResult.photo.url, { responseType: 'arraybuffer' });
        const image = response.data;
        doc.image(image, { fit: [100, 100], align: 'center' });
      } catch (error) {
        console.error('Error loading image:', error);
      }
    }

    // Add table of subject scores
    doc.moveDown();
    doc.fontSize(14).text('Subject Scores:', { underline: true });
    studentResult.subjectScores.forEach(score => {
      doc.fontSize(12).text(`Subject: ${score.name}`);
      doc.fontSize(12).text(`Score: ${score.score}`);
      doc.fontSize(12).text(`Grade: ${score.grade}`);
      doc.fontSize(12).text(`Remarks: ${score.remarks}`);
      doc.fontSize(12).text(`Position: ${score.position}`);
      doc.moveDown();
    });

    // Add overall score and position
    doc.fontSize(14).text(`Total Score: ${studentResult.totalScore}`);
    doc.fontSize(14).text(`Overall Position: ${studentResult.position}`);

    doc.end();

    // Wait for the file to be written and then resolve the promise
    doc.on('end', () => {
      resolve(filePath);
    });

    doc.on('error', (err) => {
      reject(err);
    });
  });
};

module.exports = generateResultsPDF;



