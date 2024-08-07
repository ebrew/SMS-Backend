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

  // Add document title
  doc.fontSize(20).text('Student Results', { align: 'center' }).moveDown(1.5);

  // Add student information
  doc.fontSize(14).text(`Academic Year: ${studentResult.academicYear || 'N/A'}`);
  doc.text(`Academic Term: ${studentResult.academicTerm || 'N/A'}`);
  doc.text(`Class: ${studentResult.classSession || 'N/A'}`);
  doc.text(`Student Name: ${studentResult.fullName || 'N/A'}`);

  // Download and add student photo
  const photoPath = path.join(tempDir, 'photo.jpg');
  await downloadImage(studentResult.photo, photoPath);
  doc.moveDown().image(photoPath, { width: 100, height: 100, align: 'center' }).moveDown(1.5);

  // Draw table headers
  doc.fontSize(12).fillColor('#000000')
    .text('Subject', 50, doc.y, { width: 100, align: 'left', underline: true })
    .text('Score', 150, doc.y, { width: 100, align: 'left', underline: true })
    .text('Grade', 250, doc.y, { width: 100, align: 'left', underline: true })
    .text('Remarks', 350, doc.y, { width: 100, align: 'left', underline: true })
    .text('Position', 450, doc.y, { width: 100, align: 'left', underline: true });

  // Draw table rows with alternate row colors
  let y = doc.y + 5;
  studentResult.subjectScores.forEach((score, index) => {
    doc.fillColor(index % 2 === 0 ? '#F0F0F0' : '#FFFFFF')
      .rect(50, y - 2, 500, 20).fill();
    doc.fillColor('#000000')
      .text(score.name || 'N/A', 50, y, { width: 100, align: 'left' })
      .text(score.score || 'N/A', 150, y, { width: 100, align: 'left' })
      .text(score.grade || 'N/A', 250, y, { width: 100, align: 'left' })
      .text(score.remarks || 'N/A', 350, y, { width: 100, align: 'left' })
      .text(score.position || 'N/A', 450, y, { width: 100, align: 'left' });
    y += 20;
  });

  // Add total score and overall position
  doc.moveDown().fillColor('#000000')
    .text(`Total Score: ${studentResult.totalScore || 'N/A'}`, 50, y)
    .text(`Overall Position: ${studentResult.position || 'N/A'}`, 50, y + 20);

  doc.end();

  // Clean up the downloaded photo
  fs.unlinkSync(photoPath);

  return pdfPath;
};

module.exports = generateResultsPDF;
