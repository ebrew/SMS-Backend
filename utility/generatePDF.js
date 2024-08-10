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

  // University Header
  doc.fontSize(14).fillColor('#1a237e').text('St.Peters Junior High School', { align: 'center' });
    doc.fontSize(12).fillColor('black').text('Student Results', { align: 'center' });
    
    doc.moveDown(2)

    doc.fontSize(12).fillColor('black')
    .text(`Academic Year : 2024 / 2025`)
    .text(`Academic Term : Term 1`)
    .text(`Class : ${studentResult.classSession || 'N/A'}`)
    .text(`Student : ${studentResult.fullName || 'N/A'}`);


  doc.rect(40,205,pageWidth-80,rowHeight).fill('blue').stroke()
    
  // Draw headers
  doc.fontSize(12).font('Helvetica-Bold');
  doc.fillColor("white").text("Subject",70,209)

  doc.fillColor("white").text("Score",230,209)

  doc.fillColor("white").text("Grade",300,209)

  doc.fillColor("white").text("Remarks",370,209)

  doc.fillColor("white").text("Position",490,209)

  doc.fontSize(10).font('Helvetica');


  studentResult.subjectScores.forEach((course, index) => {
    const rowColor = i % 2 === 0 ? '#e8eaf6' : '#ffffff'; // Alternate row colors

    doc.rect(40,225 + 27 * i,pageWidth-80,25).fill(rowColor).stroke()

    doc.fillColor("black").text(data.name, 70 , 230 + 27 * i,{width:160});
    doc.fillColor("black").text(data.score, 230 , 230 + 27 * i);
    doc.fillColor("black").text(data.grade, 300 , 230 + 27 * i);
    doc.fillColor("black").text(data.remarks, 370 , 230 + 27 * i);
    doc.fillColor("black").text(data.position, 490 , 230 + 27 * i);
  });

  // Summary Information
  // y += 30;
  // doc.fontSize(12).fillColor('#000000')
  // .text(`Total Score: ${studentResult.totalScore || 'N/A'}`, 50, y)
  // .text(`Overall Position: ${studentResult.position || 'N/A'}`, 50, y + 20);

  // Signature lines
  // y += 180;
  // doc.fontSize(12).fillColor('#000000')
  //   .text('Student\'s Signature................................................', 50, y)
  //   .text('Academic Supervisor/Exams Officer\'s Signature................................................', 50, y + 20);

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






