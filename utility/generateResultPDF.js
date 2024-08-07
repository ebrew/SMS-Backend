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

  // Add student information and photo
  const photoPath = path.join(tempDir, 'photo.jpg');
  await downloadImage(studentResult.photo.url, photoPath);

  const studentInfo = [
    `Academic Year: ${studentResult.academicYear || 'N/A'}`,
    `Academic Term: ${studentResult.academicTerm || 'N/A'}`,
    `Class: ${studentResult.classSession || 'N/A'}`,
    `Student Name: ${studentResult.fullName || 'N/A'}`,
  ];

  const photoX = doc.page.width - 150;
  doc.image(photoPath, photoX, doc.y, { fit: [100, 100], align: 'right' });

  studentInfo.forEach((info, index) => {
    doc.text(info, 50, doc.y + (index * 20));
  });

  doc.moveDown(1.5);

  // Draw table headers
  const tableX = 50;
  const tableHeaders = ['Subject', 'Score', 'Grade', 'Remarks', 'Position'];
  const tableColumnWidths = [200, 100, 100, 100, 100];
  
  tableHeaders.forEach((header, index) => {
    doc.text(header, tableX + tableColumnWidths.slice(0, index).reduce((a, b) => a + b, 0), doc.y, {
      width: tableColumnWidths[index],
      align: 'left',
      underline: true
    });
  });

  doc.moveDown(1.5);

  // Draw table rows with alternate row colors and increased height
  let y = doc.y; // Adjust the starting y position for rows
  const rowHeight = 25; // Increase row height for better readability
  studentResult.subjectScores.forEach((score, index) => {
    doc.fillColor(index % 2 === 0 ? '#F0F0F0' : '#FFFFFF')
      .rect(tableX, y, tableColumnWidths.reduce((a, b) => a + b, 0), rowHeight).fill(); // Increase row height
    
    doc.fillColor('#000000')
      .text(score.name || 'N/A', tableX, y + 5, { width: tableColumnWidths[0], align: 'left' })
      .text(score.score || 'N/A', tableX + tableColumnWidths[0], y + 5, { width: tableColumnWidths[1], align: 'left' })
      .text(score.grade || 'N/A', tableX + tableColumnWidths[0] + tableColumnWidths[1], y + 5, { width: tableColumnWidths[2], align: 'left' })
      .text(score.remarks || 'N/A', tableX + tableColumnWidths[0] + tableColumnWidths[1] + tableColumnWidths[2], y + 5, { width: tableColumnWidths[3], align: 'left' })
      .text(score.position || 'N/A', tableX + tableColumnWidths[0] + tableColumnWidths[1] + tableColumnWidths[2] + tableColumnWidths[3], y + 5, { width: tableColumnWidths[4], align: 'left' });

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
