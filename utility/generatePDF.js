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

exports.generateResultsPDF = async (studentResult) => {
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

  // Add student information with photo aligned to the right
  const photoPath = path.join(tempDir, 'photo.jpg');
  await downloadImage(studentResult.photo.url, photoPath);

  const infoY = doc.y;
  doc.fontSize(14)
    .text(`Academic Year: ${studentResult.academicYear || 'N/A'}`)
    .text(`Academic Term: ${studentResult.academicTerm || 'N/A'}`)
    .text(`Class: ${studentResult.classSession || 'N/A'}`)
    .text(`Student Name: ${studentResult.fullName || 'N/A'}`);

  doc.image(photoPath, doc.page.width - 150, infoY, { width: 100, height: 100 });

  // Move the cursor down after the image to create space for headers
  doc.moveDown(4);

  // Draw table headers
  doc.fontSize(12).fillColor('#000000');
  const headers = ['Subject', 'Score', 'Grade', 'Remarks', 'Position'];
  const headerX = [50, 200, 300, 400, 500];
  headers.forEach((header, i) => {
    doc.text(header, headerX[i], doc.y, { underline: true });
  });

  // Draw table rows with alternate row colors and increased height
  let y = doc.y + 15; // Adjust the starting y position for rows
  const rowHeight = 30; // Increase row height for better readability
  studentResult.subjectScores.forEach((score, index) => {
    doc.fillColor(index % 2 === 0 ? '#F0F0F0' : '#FFFFFF')
      .rect(50, y - 5, 550, rowHeight).fill(); // Increase row height
    doc.fillColor('#000000');
    const values = [score.name || 'N/A', score.score || 'N/A', score.grade || 'N/A', score.remarks || 'N/A', score.position || 'N/A'];
    values.forEach((value, i) => {
      doc.text(value, headerX[i], y, { width: headerX[i+1] ? headerX[i+1] - headerX[i] - 10 : 95, align: 'left' });
    });
    y += rowHeight;
  });

  // Add some space before adding the total score and overall position
  y += 20;

  // Add total score and overall position
  doc.fillColor('#000000')
    .text(`Total Score: ${studentResult.totalScore || 'N/A'}`, 50, y)
    .text(`Overall Position: ${studentResult.position || 'N/A'}`, 50, y + 20);

  doc.end();

  // Clean up the downloaded photo
  fs.unlinkSync(photoPath);

  return pdfPath;
};

exports.generateFeesPDF = async (studentFees) => {
  const doc = new PDFDocument({ margin: 50 });
  const pdfPath = path.join(__dirname, `${studentFees.fullName.replace(/ /g, '_')}_fees.pdf`);
  
  // Ensure the directory exists
  const tempDir = path.dirname(pdfPath);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  doc.pipe(fs.createWriteStream(pdfPath));

  // Add document title
  doc.fontSize(20).text('Student Fees', { align: 'center' }).moveDown(1.5);

  // Add student information with photo aligned to the right
  const photoPath = path.join(tempDir, 'photo.jpg');
  await downloadImage(studentFees.photo.url, photoPath);

  const infoY = doc.y;
  doc.fontSize(14)
    .text(`Academic Year: ${studentFees.academicYear || 'N/A'}`)
    .text(`Academic Term: ${studentFees.academicTerm || 'N/A'}`)
    .text(`Class: ${studentFees.classSession || 'N/A'}`)
    .text(`Student Name: ${studentFees.fullName || 'N/A'}`);

  doc.image(photoPath, doc.page.width - 150, infoY, { width: 100, height: 100 });

  // Move the cursor down after the image to create space for headers
  doc.moveDown(4);

  // Draw table headers
  doc.fontSize(12).fillColor('#000000');
  const headers = ['Item', 'Amount (GHS)'];
  const headerX = [50, 200];
  headers.forEach((header, i) => {
    doc.text(header, headerX[i], doc.y, { underline: true });
  });

  // Draw table rows with alternate row colors and increased height
  let y = doc.y + 15; // Adjust the starting y position for rows
  const rowHeight = 30; // Increase row height for better readability
  studentFees.currentBill.forEach((bill, index) => {
    doc.fillColor(index % 2 === 0 ? '#F0F0F0' : '#FFFFFF')
      .rect(50, y - 5, 550, rowHeight).fill(); // Increase row height
    doc.fillColor('#000000');
    const values = [bill.name, bill.amount];
    values.forEach((value, i) => {
      doc.text(value, headerX[i], y, { width: headerX[i+1] ? headerX[i+1] - headerX[i] - 10 : 95, align: 'left' });
    });
    y += rowHeight;
  });

  // Add some space before adding the total and overpaid amounts
  y += 20;

  // Add totals and final details
  doc.fillColor('#000000')
    .text(`Total Fees: ${studentFees.currentBillTotal || 'N/A'}`, 50, y)
    .text(`Previous Balance: ${studentFees.overPaid + studentFees.previousOwed || 'N/A'}`, 50, y + 20)
    .text(`Amount Payable: ${studentFees.payable || 'N/A'}`, 50, y + 40);

  doc.end();

  // Clean up the downloaded photo
  fs.unlinkSync(photoPath);

  return pdfPath;
};



