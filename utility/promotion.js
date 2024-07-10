const { AcademicYear, ClassSession, Class, Section, ClassStudent, Student, Grade, Assessment } = require('../models');
const { Op } = require('sequelize');

const validateAcademicYear = async (academicYearId) => {
  const academicYear = await AcademicYear.findByPk(academicYearId);
  if (!academicYear) throw new Error('Academic year not found!');
  await academicYear.setInactiveIfEndDateDue();
  if (academicYear.status !== 'Active') throw new Error('Academic year is not active!');
  return academicYear;
};

const validateClassSession = async (classSessionId) => {
  const classSession = await ClassSession.findByPk(classSessionId);
  if (!classSession) throw new Error('Class session not found!');
  return classSession;
};

const validateStudents = async (academicYearId, classSessionId) => {
  const students = await ClassStudent.findAll({
    where: { academicYearId, classSessionId },
    include: { model: Student, attributes: ['id', 'firstName', 'middleName', 'lastName'] }
  });
  if (!students.length) throw new Error('No students found for this class session and academic year!');
  return students;
};

const validateGrades = async (studentId, academicTermId) => {
  const grades = await Grade.findAll({
    where: { studentId, academicTermId },
    include: { model: Assessment, attributes: ['weight', 'marks', 'name'] }
  });
  if (!grades.length) throw new Error('No grades found for the student for this academic term!');
  return grades;
};

const getPromotionEligibility = (totalScore, passMark) => {
  return totalScore >= passMark;
};

const getNextClassSessionId = async (currentClassSessionId) => {
  const currentSection = await Section.findByPk(currentClassSessionId);
  if (!currentSection) {
    throw new Error('Current class session not found');
  }

  const currentClass = await Class.findByPk(currentSection.classId);
  if (!currentClass) {
    throw new Error('Class not found for the current session');
  }

  const nextClass = await Class.findOne({
    where: { grade: currentClass.grade + 1 }
  });

  if (!nextClass) {
    throw new Error('Next class not found');
  }

  const nextSection = await Section.findOne({
    where: { classId: nextClass.id }
  });

  if (!nextSection) {
    throw new Error('Next class session not found');
  }

  return nextSection.id;
};


module.exports = {
  validateAcademicYear,
  validateClassSession,
  validateStudents,
  validateGrades,
  getPromotionEligibility,
  getNextClassSessionId
};
