const PDFDocument = require('pdfkit');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

const generateResultsPDF = async (studentResult) => {
  const doc = new PDFDocument();

  // Define the output path for the PDF
  const pdfPath = path.join(__dirname, `${studentResult.fullName.replace(/ /g, '_')}_results.pdf`);
  doc.pipe(fs.createWriteStream(pdfPath));

  // Add a header with centered text
  doc.fontSize(18).text('Student Results', { align: 'center' });
  doc.moveDown();

  // Add the student information
  doc.fontSize(14).text(`Academic Year: ${studentResult.academicYear}`);
  doc.text(`Academic Term: ${studentResult.academicTerm}`);
  doc.text(`Class: ${studentResult.classSession}`);
  doc.text(`Student Name: ${studentResult.fullName}`);
  
  // Add the student photo if available
  if (studentResult.photo && studentResult.photo.url) {
    doc.moveDown();
    doc.image(studentResult.photo.url, { width: 100, height: 100, align: 'center' });
  }
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
