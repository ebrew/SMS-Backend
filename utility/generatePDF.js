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

  // School name
  doc.fontSize(16).fillColor('#1a237e')
    .text('SCHOOL NAME', { align: 'center' }).moveDown(0.5);

  // Doc title
  doc.fontSize(14).fillColor('#000000')
    .text(`RESULTS SLIP`, { align: 'center' }).moveDown(1.5);

  // Student Information
  const infoY = doc.y;
  doc.fontSize(12).fillColor('#000000')
    .text(`Academic Year: ${studentResult.academicYear || 'N/A'}`, 50)
    .text(`Class: ${studentResult.classSession || 'N/A'}`, 50)
    .text(`Student Name: ${studentResult.fullName || 'N/A'}`, 50)
    .text(`Date Printed: ${new Date().toLocaleDateString()}`, 50);

  // Add the student's photo
  const photoPath = path.join(tempDir, 'photo.jpg');
  await downloadImage(studentResult.photo.url, photoPath);
  doc.image(photoPath, doc.page.width - 150, infoY, { width: 100, height: 100 });

  // Move down before the table
  doc.moveDown(2);

  // Draw table headers with adjusted widths
  doc.fontSize(12).fillColor('#ffffff').rect(50, doc.y, 500, 25).fill('#1a237e');
  const headers = ['Subject', 'Score', 'Grade', 'Remarks', 'Position'];
  const headerX = [50, 250, 320, 380, 450];
  headers.forEach((header, i) => {
    doc.text(header, headerX[i], doc.y + 8, { width: headerX[i + 1] ? headerX[i + 1] - headerX[i] - 10 : 80, align: 'left' });
  });

  // Draw table rows with adjusted column widths
  let y = doc.y + 30;
  studentResult.subjectScores.forEach((course, index) => {
    const rowColor = index % 2 === 0 ? '#e8eaf6' : '#ffffff'; // Alternate row colors
    doc.fillColor(rowColor).rect(50, y - 5, 500, 20).fill();
    doc.fillColor('#000000');
    const values = [course.name || 'N/A', course.score || 'N/A', course.grade || 'N/A', course.remarks || 'N/A', course.position || 'N/A'];
    values.forEach((value, i) => {
      doc.text(value, headerX[i], y, { width: headerX[i + 1] ? headerX[i + 1] - headerX[i] - 10 : 80, align: 'left' });
    });
    y += 20;
  });

  // Summary Information
  y += 30;
  doc.fontSize(12).fillColor('#000000')
    .text(`Total Score: ${studentResult.totalScore || 'N/A'}`, 50, y)
    .text(`Overall Position: ${studentResult.position || 'N/A'}`, 50, y + 20);

  // Signature lines
  y += 180;
  doc.fontSize(12).fillColor('#000000')
    .text('Student\'s Signature................................................', 50, y)
    .text('Academic Supervisor/Exams Officer\'s Signature................................................', 50, y + 20);

  doc.end();

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

  // Add document header with specific colors
  doc.fontSize(16).fillColor('#1a237e').text('SCHOOL NAME', { align: 'center' }).moveDown(0.5);
  doc.fontSize(14).fillColor('#1a237e').text('FINANCE OFFICE (STUDENTS\' SECTION)', { align: 'center' }).moveDown(0.5);
  doc.fontSize(20).fillColor('#e65100').text('Bill Statement', { align: 'center' }).moveDown(1.5);

  // Add student information with photo aligned to the right
  const photoPath = path.join(tempDir, 'photo.jpg');
  await downloadImage(studentFees.photo.url, photoPath);

  const infoY = doc.y;
  doc.fontSize(14).fillColor('#000000')
    .text(`Student ID: ${studentFees.studentId || 'N/A'}`)
    .text(`Academic Year: ${studentFees.academicYear || 'N/A'}`)
    .text(`Class: ${studentFees.classSession || 'N/A'}`)
    .text(`Index Number: ${studentFees.indexNumber || 'N/A'}`)
    .text(`Student Name: ${studentFees.fullName || 'N/A'}`)
    .text(`Programme: ${studentFees.program || 'N/A'}`)
    .text(`Date: ${new Date().toLocaleDateString()}`)
    .moveDown(1.5);

  doc.image(photoPath, doc.page.width - 150, infoY, { width: 100, height: 100 });

  doc.moveDown(4);

  // Draw table headers with color
  doc.fontSize(12).fillColor('#ffffff').rect(50, doc.y - 5, 500, 25).fill('#1a237e');
  const headers = ['Sn', 'Item', 'Amount (GHS)'];
  const headerX = [50, 100, 400];
  headers.forEach((header, i) => {
    doc.text(header, headerX[i], doc.y - 5, { width: headerX[i + 1] ? headerX[i + 1] - headerX[i] - 10 : 95, align: 'left' });
  });

  // Draw table rows with alternate row colors
  let y = doc.y + 20;
  studentFees.currentBill.forEach((bill, index) => {
    const rowColor = index % 2 === 0 ? '#e8eaf6' : '#ffffff'; // Light purple and white for alternate rows
    doc.fillColor(rowColor).rect(50, y - 5, 500, 20).fill();
    doc.fillColor('#000000');
    const values = [(index + 1).toString(), bill.name, bill.amount.toFixed(2)];
    values.forEach((value, i) => {
      doc.text(value, headerX[i], y, { width: headerX[i + 1] ? headerX[i + 1] - headerX[i] - 10 : 95, align: 'left' });
    });
    y += 20;
  });

  // Add totals and final details with colored text
  y += 20;
  doc.fontSize(12).fillColor('#000000')
    .text(`Total Fees: GHS ${studentFees.currentBillTotal?.toFixed(2) || 'N/A'}`, 50, y)
    .text(`Previous Balance: GHS ${(studentFees.previousOwed + studentFees.overPaid).toFixed(2) || 'N/A'}`, 50, y + 20)
    .text(`Amount Paid: GHS ${studentFees.amountPaid?.toFixed(2) || 'N/A'}`, 50, y + 40)
    .text(`Amount Payable: GHS ${studentFees.payable?.toFixed(2) || 'N/A'}`, 50, y + 100);

  // Add signature section
  doc.moveDown(4);
  doc.fontSize(12).fillColor('#000000')
    .text('Prepared by............................................................', 50, doc.y + 20)
    .text('Signature............................................................', 50, doc.y + 20);

  doc.end();

  // Clean up the downloaded photo
  fs.unlinkSync(photoPath);

  return pdfPath;
};
