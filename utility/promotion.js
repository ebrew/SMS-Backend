const { AcademicYear, AcademicTerm, Class, Section, ClassStudent, Student, Grade, Assessment } = require("../db/models/index");

const fetchAcademicYears = async () => {
    try {
        let activeYear = await AcademicYear.findOne({ where: { status: 'Active' } });
        let pendingYear = await AcademicYear.findOne({ where: { status: 'Pending' } });

        if (activeYear && activeYear.endDate <= new Date()) {
            await activeYear.update({ status: 'Inactive' });
            activeYear = await AcademicYear.findOne({ where: { status: 'Active' } });
        }

        if (pendingYear && pendingYear.startDate <= new Date()) {
            await pendingYear.update({ status: 'Active' });
            pendingYear = await AcademicYear.findOne({ where: { status: 'Pending' } });
        }

        if (!pendingYear) throw new Error('No promotion academic year found!');
        
        if(!activeYear){
            activeYear = await AcademicYear.findOne({ where: { status: 'Inactive' }, order: [['createdAt', 'DESC']] });
        }

        return { activeYear, pendingYear };
    } catch (error) {
        console.error('Error fetching academic years:', error);
        throw error; // Re-throw the error to be handled by the calling function
    }
};

const validateClassSession = async (classSessionId) => {
    try {
        const classSession = await Section.findByPk(classSessionId);

        if (!classSession) throw new Error('Promotion class session not found!');

        return classSession
    } catch (error) {
        console.error('Error validating class sessions:', error);
        throw error; // Re-throw the error to be handled by the calling function
    }
};

const validateAcademicYears = async (promotion) => {
    try {
        // Fetch the pending academic year using the provided promotion ID
        const pendingYear = await AcademicYear.findByPk(promotion);

        // Fetch the active academic year, excluding the promotion year
        const activeYear = await AcademicYear.findOne({
            where: {
              id: { [Op.ne]: promotion }, // Exclude the promotion academic year
            },
            order: [['endDate', 'DESC']],
        });

        // Validate the pending academic year
        if (!pendingYear) throw new Error('Promotional academic year not found!');
        if (pendingYear.status !== 'Pending' && pendingYear.status !== 'Active' ) throw new Error('Promotional academic year provided is inactive!');

        if (!activeYear) throw new Error('Promotional academic year provided is the same as the current academic year!');

        return { activeYear, pendingYear };
    } catch (error) {
        console.error('Error fetching academic years:', error);
        throw error; // Re-throw the error to be handled by the calling function
    }
};

const validateTermAndYear = async (term, year) => {
    try {
        if (term === 0) {
            const academicYear = await AcademicYear.findByPk(year);
            if (!academicYear) throw new Error('Academic year not found!');
            return academicYear;
        }

        const academicTerm = await AcademicTerm.findByPk(term, {
            include: { model: AcademicYear }
        });
        const academicYear = await AcademicYear.findByPk(year);

        if (!academicYear) throw new Error('Academic year not found!');
        if(academicYear.status === 'Inactive') throw new Error("Academic year has already ended!");
        if (!academicTerm) throw new Error('Academic term not found!');
        if(academicTerm.status === 'Inactive') throw new Error("Academic term has already ended!");

        if (academicTerm.AcademicYear.id !== academicYear.id) {
            throw new Error('Academic term does not belong to the academic year!');
        }

        return { academicTerm, academicYear };
    } catch (error) {
        console.error('Error fetching academic years:', error);
        throw error; // Re-throw the error to be handled by the calling function
    }
};

const validateStudents = async (academicYearId, classSessionId) => {
    try {
        const students = await ClassStudent.findAll({
            where: { academicYearId, classSessionId },
            include: { model: Student, attributes: ['id', 'firstName', 'middleName', 'lastName'] }
        });
        if (!students.length) throw new Error('No students found for this class session and academic year!');
        return students;
    } catch (error) {
        console.error('Error validating students:', error);
        throw error; // Re-throw the error to be handled by the calling function
    }
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
    validateClassSession,
    fetchAcademicYears,
    validateAcademicYears,
    validateTermAndYear
};
