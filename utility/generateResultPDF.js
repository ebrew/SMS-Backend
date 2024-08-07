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
  const doc = new PDFDocument({ margin: 50 });
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
  await downloadImage(studentResult.photo.url, photoPath);
  doc.moveDown().image(photoPath, { fit: [100, 100], align: 'center' }).moveDown(1.5);

  // Draw table headers
  doc.fontSize(12).fillColor('#000000')
    .text('Subject', 50, doc.y, { width: 150, align: 'left', underline: true })
    .text('Score', 200, doc.y, { width: 100, align: 'left', underline: true })
    .text('Grade', 300, doc.y, { width: 100, align: 'left', underline: true })
    .text('Remarks', 400, doc.y, { width: 100, align: 'left', underline: true })
    .text('Position', 500, doc.y, { width: 100, align: 'left', underline: true });

  // Draw table rows with alternate row colors and increased height
  let y = doc.y + 5;
  const rowHeight = 25;
  studentResult.subjectScores.forEach((score, index) => {
    doc.fillColor(index % 2 === 0 ? '#F0F0F0' : '#FFFFFF')
      .rect(50, y - 2, 550, rowHeight).fill();
    doc.fillColor('#000000')
      .text(score.name || 'N/A', 50, y, { width: 150, align: 'left' })
      .text(score.score || 'N/A', 200, y, { width: 100, align: 'left' })
      .text(score.grade || 'N/A', 300, y, { width: 100, align: 'left' })
      .text(score.remarks || 'N/A', 400, y, { width: 100, align: 'left' })
      .text(score.position || 'N/A', 500, y, { width: 100, align: 'left' });
    y += rowHeight;
  });

  // Add some space before adding the total score and overall position
  y += 20;

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
