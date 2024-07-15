const { AcademicYear, Class, Section, ClassStudent, Student, Grade, Assessment } = require("../db/models/index");

// i'll check the logic later
const validateAcademicYear = async (academicYearId) => {
    const academicYear = await AcademicYear.findByPk(academicYearId);
    if (!academicYear) throw new Error('Academic year not found!');
    await academicYear.setInactiveIfEndDateDue();
    if (academicYear.status !== 'Active') throw new Error('Academic year is not active!');
    return academicYear;
};

const fetchAcademicYears = async () => {

    // Fetch active and pending academic
    let activeYear = await AcademicYear.findOne({ where: { status: 'Active' } });
    let pendingYear = await AcademicYear.findOne({ where: { status: 'Pending' } });

    if (activeYear) await activeYear.setInactiveIfEndDateDue();
    activeYear = await AcademicYear.findOne({ where: { status: 'Active' } });
    
    if (pendingYear) await pendingYear.setInactiveIfEndDateDue();
    pendingYear = await AcademicYear.findOne({ where: { status: 'Pending' } });

    if (!activeYear) throw new Error('No active academic year found!');

    if (!pendingYear) throw new Error('No promotion academic year found!');

    // Return both class sessions
    return { activeYear, pendingYear };
};

const validateClassSession = async (classSessionId, nextClassSessionId) => {

    const classSession = await Section.findByPk(classSessionId);
    const nextClassSession = await Section.findByPk(nextClassSessionId);

    if (!classSession) {
        throw new Error('Class session not found!');
    }

    if (!nextClassSession) {
        throw new Error('Promotion class session not found!');
    }

    // Return both class sessions
    return { classSession, nextClassSession };
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
    getNextClassSessionId,
    fetchAcademicYears,
};
