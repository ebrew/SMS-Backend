const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateResultsPDF1 = async (studentResult) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const pdfPath = `./temp/${studentResult.fullName.replace(/ /g, '_')}_results.pdf`;

    // Ensure the directory exists
    const tempDir = path.dirname(pdfPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    doc.pipe(fs.createWriteStream(pdfPath));

    doc.fontSize(16).text(`Student Results`, { align: 'center' });

    doc.fontSize(12).text(`Academic Year: ${studentResult.academicYear || 'N/A'}`);
    doc.text(`Academic Term: ${studentResult.academicTerm || 'N/A'}`);
    doc.text(`Class: ${studentResult.classSession || 'N/A'}`);
    doc.text(`Student Name: ${studentResult.fullName || 'N/A'}`);

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

    doc.on('finish', () => {
      resolve(pdfPath);
    });

    doc.on('error', (err) => {
      console.error('PDF generation error:', err); // Error handling
      reject(err);
    });
  });
};

const generateResultsPDF = async (studentResult) => {
  const doc = new PDFDocument();

  // Define the output path for the PDF
  const pdfPath = path.join(__dirname, `${studentResult.fullName.replace(/ /g, '_')}_results.pdf`);
  doc.pipe(fs.createWriteStream(pdfPath));

  // Add a header with centered text
  doc.fontSize(16).text('Student Results', { align: 'center' });
  doc.moveDown();

  // Add the student information
  doc.fontSize(12).text(`Academic Year: ${studentResult.academicYear || 'N/A'}`);
  doc.text(`Academic Term: ${studentResult.academicTerm || 'N/A'}`);
  doc.text(`Class: ${studentResult.classSession || 'N/A'}`);
  doc.text(`Student Name: ${studentResult.fullName || 'N/A'}`);

  // Add the student photo
  doc.moveDown();
  doc.image(studentResult.photo.url, { width: 100, height: 100, align: 'center' });
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

  return pdfPath;
};

const generateResultsPDF2 = async (studentResult) => {
  const doc = new PDFDocument();

  // Define the output path for the PDF
  const pdfPath = path.join(__dirname, `${studentResult.fullName.replace(/ /g, '_')}_results.pdf`);
  doc.pipe(fs.createWriteStream(pdfPath));

  // Add a header with centered text
  doc.fontSize(18).text('Student Results', { align: 'center' });
  doc.moveDown();

  // Add the student information
  doc.fontSize(14).text(`Academic Year: ${studentResult.academicYear || 'N/A'}`);
  doc.text(`Academic Term: ${studentResult.academicTerm || 'N/A'}`);
  doc.text(`Class: ${studentResult.classSession || 'N/A'}`);
  doc.text(`Student Name: ${studentResult.fullName || 'N/A'}`);

  // Add the student photo
  doc.moveDown();
  doc.image(studentResult.photo.url, { width: 100, height: 100, align: 'center' });
  doc.moveDown();

  // Add a table for the subject scores
  const tableTop = doc.y;
  const itemCodeX = 50;
  const descriptionX = 150;
  const priceX = 280;
  const quantityX = 350;
  const totalX = 430;

  doc.fontSize(12);
  doc.text('Subject', itemCodeX, tableTop);
  doc.text('Score', descriptionX, tableTop);
  doc.text('Grade', priceX, tableTop);
  doc.text('Remarks', quantityX, tableTop);
  doc.text('Position', totalX, tableTop);

  doc.moveDown();
  let position = tableTop + 20;
  studentResult.subjectScores.forEach((item) => {
    doc.text(item.name, itemCodeX, position);
    doc.text(item.score, descriptionX, position);
    doc.text(item.grade, priceX, position);
    doc.text(item.remarks, quantityX, position);
    doc.text(item.position, totalX, position);
    position += 20;
  });

  // Add overall score and position
  doc.moveDown();
  doc.fontSize(14).text(`Total Score: ${studentResult.totalScore}`);
  doc.text(`Overall Position: ${studentResult.position}`);

  // End the document
  doc.end();

  return pdfPath;
};

module.exports = generateResultsPDF;
