const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const downloadImage = async (url, filepath) => {
  const response = await axios({
    url,
    responseType: 'stream',
  });
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
};

const generateResultsPDF = async (studentResult) => {
  const doc = new PDFDocument();
  const pdfPath = path.join(__dirname, `${studentResult.fullName.replace(/ /g, '_')}_results.pdf`);
  
  // Ensure the directory exists
  const tempDir = path.dirname(pdfPath);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  doc.pipe(fs.createWriteStream(pdfPath));

  doc.fontSize(16).text('Student Results', { align: 'center' });
  doc.moveDown();

  doc.fontSize(12).text(`Academic Year: ${studentResult.academicYear || 'N/A'}`);
  doc.text(`Academic Term: ${studentResult.academicTerm || 'N/A'}`);
  doc.text(`Class: ${studentResult.classSession || 'N/A'}`);
  doc.text(`Student Name: ${studentResult.fullName || 'N/A'}`);

  // Download the student photo
  const photoPath = path.join(tempDir, 'photo.jpg');
  await downloadImage(studentResult.photo, photoPath);

  // Add the student photo
  doc.moveDown();
  doc.image(photoPath, { width: 100, height: 100, align: 'center' });
  doc.moveDown();

  // Draw the table
  const tableTop = 200;
  const itemHeight = 20;
  let y = tableTop;

  doc.fontSize(12)
    .text('Subject', 50, y, { width: 100 })
    .text('Score', 150, y, { width: 100 })
    .text('Grade', 250, y, { width: 100 })
    .text('Remarks', 350, y, { width: 100 })
    .text('Position', 450, y, { width: 100 });

  y += itemHeight;

  studentResult.subjectScores.forEach(score => {
    doc.text(score.name || 'N/A', 50, y, { width: 100 });
    doc.text(score.score || 'N/A', 150, y, { width: 100 });
    doc.text(score.grade || 'N/A', 250, y, { width: 100 });
    doc.text(score.remarks || 'N/A', 350, y, { width: 100 });
    doc.text(score.position || 'N/A', 450, y, { width: 100 });
    y += itemHeight;
  });

  doc.text(`Total Score: ${studentResult.totalScore || 'N/A'}`, 50, y);
  doc.text(`Overall Position: ${studentResult.position || 'N/A'}`, 50, y + itemHeight);

  doc.end();

  // Clean up the downloaded photo
  fs.unlinkSync(photoPath);

  return pdfPath;
};

module.exports = generateResultsPDF;

