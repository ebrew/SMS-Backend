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

exports.generateResultsPDF1 = async (studentResult) => {
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
exports.generateFeesPDF1 = async (studentFees) => {
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
  const headerX = [50, 400];  // Adjusted column position for better alignment
  headers.forEach((header, i) => {
    doc.text(header, headerX[i], doc.y, { underline: true });
  });

  // Draw table rows with alternate row colors and increased height
  let y = doc.y + 15; // Adjust the starting y position for rows
  const rowHeight = 30; // Increase row height for better readability
  studentFees.currentBill.forEach((bill, index) => {
    doc.fillColor(index % 2 === 0 ? '#F0F0F0' : '#FFFFFF')
      .rect(50, y - 5, 500, rowHeight).fill(); // Increase row height
    doc.fillColor('#000000');
    const values = [bill.name, bill.amount.toFixed(2)];  // Ensure amounts are formatted to two decimal places
    values.forEach((value, i) => {
      doc.text(value, headerX[i], y, { width: headerX[i+1] ? headerX[i+1] - headerX[i] - 10 : 95, align: 'left' });
    });
    y += rowHeight;
  });

  // Add some space before adding the total and overpaid amounts
  y += 20;

  // Add totals and final details
  doc.fillColor('#000000')
    .text(`Total Fees: GHS ${studentFees.currentBillTotal?.toFixed(2) || 'N/A'}`, 50, y)
    .text(`Previous Balance: GHS ${(studentFees.previousOwed + studentFees.overPaid).toFixed(2) || 'N/A'}`, 50, y + 20)
    .text(`Amount Payable: GHS ${studentFees.payable?.toFixed(2) || 'N/A'}`, 50, y + 40);

  doc.end();

  // Clean up the downloaded photo
  fs.unlinkSync(photoPath);

  return pdfPath;
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

  // Add document header with specific colors
  doc.fontSize(16).fillColor('#1a237e').text('KWAME NKRUMAH UNIVERSITY OF SCIENCE AND TECHNOLOGY, KUMASI', { align: 'center' }).moveDown(0.5);
  doc.fontSize(14).fillColor('#1a237e').text('ACADEMIC RESULTS', { align: 'center' }).moveDown(1.5);
  doc.fontSize(20).fillColor('#e65100').text('Student Results', { align: 'center' }).moveDown(1.5);

  // Add student information with photo aligned to the right
  const photoPath = path.join(tempDir, 'photo.jpg');
  await downloadImage(studentResult.photo.url, photoPath);

  const infoY = doc.y;
  doc.fontSize(14).fillColor('#000000')
    .text(`Student ID: ${studentResult.studentID || 'N/A'}`)
    .text(`Academic Year: ${studentResult.academicYear || 'N/A'}`)
    .text(`Academic Term: ${studentResult.academicTerm || 'N/A'}`)
    .text(`Class: ${studentResult.classSession || 'N/A'}`)
    .text(`Student Name: ${studentResult.fullName || 'N/A'}`)
    .moveDown(1.5);

  doc.image(photoPath, doc.page.width - 150, infoY, { width: 100, height: 100 });

  doc.moveDown(4);

  // Draw table headers with color
  doc.fontSize(12).fillColor('#ffffff').rect(50, doc.y - 5, 550, 25).fill('#1a237e');
  const headers = ['Subject', 'Score', 'Grade', 'Remarks', 'Position'];
  const headerX = [50, 200, 300, 400, 500];
  headers.forEach((header, i) => {
    doc.text(header, headerX[i], doc.y - 5, { width: headerX[i+1] ? headerX[i+1] - headerX[i] - 10 : 95, align: 'left' });
  });

  // Draw table rows with alternate row colors
  let y = doc.y + 20;
  const rowHeight = 30; // Increase row height for better readability
  studentResult.subjectScores.forEach((score, index) => {
    const rowColor = index % 2 === 0 ? '#e8eaf6' : '#ffffff'; // Light purple and white for alternate rows
    doc.fillColor(rowColor).rect(50, y - 5, 550, rowHeight).fill();
    doc.fillColor('#000000');
    const values = [score.name || 'N/A', score.score || 'N/A', score.grade || 'N/A', score.remarks || 'N/A', score.position || 'N/A'];
    values.forEach((value, i) => {
      doc.text(value, headerX[i], y, { width: headerX[i+1] ? headerX[i+1] - headerX[i] - 10 : 95, align: 'left' });
    });
    y += rowHeight;
  });

  // Add total score and overall position with space
  y += 20;
  doc.fontSize(12).fillColor('#000000')
    .text(`Total Score: ${studentResult.totalScore || 'N/A'}`, 50, y)
    .text(`Overall Position: ${studentResult.position || 'N/A'}`, 50, y + 20);

  // Add "Prepared by" section and signature
  y += 60;
  doc.moveDown(4);
  doc.fontSize(12).fillColor('#000000')
    .text('Prepared by............................................................', 50, y + 20)
    .text('Signature............................................................', 50, y + 40);

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

  // Add document header with specific colors
  doc.fontSize(16).fillColor('#1a237e').text('KWAME NKRUMAH UNIVERSITY OF SCIENCE AND TECHNOLOGY, KUMASI', { align: 'center' }).moveDown(0.5);
  doc.fontSize(14).fillColor('#1a237e').text('FINANCE OFFICE (STUDENTS\' SECTION)', { align: 'center' }).moveDown(0.5);
  doc.fontSize(20).fillColor('#e65100').text('Bill Statement', { align: 'center' }).moveDown(1.5);

  // Add student information with photo aligned to the right
  const photoPath = path.join(tempDir, 'photo.jpg');
  await downloadImage(studentFees.photo.url, photoPath);

  const infoY = doc.y;
  doc.fontSize(14).fillColor('#000000')
    .text(`Student ID: ${studentFees.studentID || 'N/A'}`)
    .text(`Academic Year: ${studentFees.academicYear || 'N/A'}`)
    .text(`Index Number: ${studentFees.indexNumber || 'N/A'}`)
    .text(`Student Name: ${studentFees.fullName || 'N/A'}`)
    .text(`Programme: ${studentFees.program || 'N/A'}`)
    .text(`Level: ${studentFees.level || 'N/A'}`)
    .text(`Date: ${new Date().toLocaleDateString()}`)
    .moveDown(1.5);

  doc.image(photoPath, doc.page.width - 150, infoY, { width: 100, height: 100 });

  doc.moveDown(4);

  // Draw table headers with color
  doc.fontSize(12).fillColor('#ffffff').rect(50, doc.y - 5, 500, 25).fill('#1a237e');
  const headers = ['Sn', 'Item', 'Amount (GHS)'];
  const headerX = [50, 100, 400];
  headers.forEach((header, i) => {
    doc.text(header, headerX[i], doc.y - 5, { width: headerX[i+1] ? headerX[i+1] - headerX[i] - 10 : 95, align: 'left' });
  });

  // Draw table rows with alternate row colors
  let y = doc.y + 20;
  studentFees.currentBill.forEach((bill, index) => {
    const rowColor = index % 2 === 0 ? '#e8eaf6' : '#ffffff'; // Light purple and white for alternate rows
    doc.fillColor(rowColor).rect(50, y - 5, 500, 20).fill();
    doc.fillColor('#000000');
    const values = [(index + 1).toString(), bill.name, bill.amount.toFixed(2)];
    values.forEach((value, i) => {
      doc.text(value, headerX[i], y, { width: headerX[i+1] ? headerX[i+1] - headerX[i] - 10 : 95, align: 'left' });
    });
    y += 20;
  });

  // Add totals and final details with colored text
  y += 20;
  doc.fontSize(12).fillColor('#000000')
    .text(`Total Fees: GHS ${studentFees.currentBillTotal?.toFixed(2) || 'N/A'}`, 50, y)
    .text(`Balance from previous academic year: GHS ${(studentFees.previousOwed + studentFees.overPaid).toFixed(2) || 'N/A'}`, 50, y + 20)
    .text(`Amount Paid: GHS ${studentFees.amountPaid?.toFixed(2) || 'N/A'}`, 50, y + 40)
    .text(`Amount Exempted: GHS ${studentFees.amountExempted?.toFixed(2) || 'N/A'}`, 50, y + 60)
    .text(`Amount Refunded: GHS ${studentFees.amountRefunded?.toFixed(2) || 'N/A'}`, 50, y + 80)
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





