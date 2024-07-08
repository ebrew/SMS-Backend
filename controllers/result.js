require('dotenv').config();
const { Op } = require('sequelize');
const passport = require('../db/config/passport')
const { Student, ClassStudent, AcademicTerm, Assessment, Grade, GradingSystem, Subject, ClassSubject, Section } = require("../db/models/index")


// Define a function to fetch grade and remarks based on totalScore
const getGradeAndRemarks = async (totalScore) => {
  const grading = await GradingSystem.findOne({
    where: {
      minScore: { [Op.lte]: totalScore },
      maxScore: { [Op.gte]: totalScore }
    }
  });
  return grading ? { grade: grading.grade, remarks: grading.remarks } : { grade: 'N/A', remarks: 'N/A' };
};

// Helper function to fetch class results
const fetchClassResults1 = async (academicTermId, classSessionId) => {
  try {
    const section = await Section.findByPk(classSessionId);
    const term = await AcademicTerm.findByPk(academicTermId);

    if (!section) throw new Error("Class section not found!");
    if (!term) throw new Error("Academic term not found!");

    // Fetching class students
    const students = await ClassStudent.findAll({
      where: {
        classSessionId,
        academicYearId: term.academicYearId
      },
      include: {
        model: Student,
        attributes: ['id', 'firstName', 'middleName', 'lastName', 'passportPhoto'],
      }
    });

    // Fetch all class subjects
    const subjects = await ClassSubject.findAll({
      where: { classId: section.classId },
      include: [
        {
          model: Subject,
          attributes: ['id', 'name'],
          order: [['name', 'ASC']]
        },
      ],
    });

    // Calculate total assessments weight for each subject
    const subjectTotalWeights = await Promise.all(subjects.map(async (subject) => {
      const subjectAssessments = await Assessment.findAll({
        where: {
          subjectId: subject.subjectId,
          classSessionId,
          academicTermId
        },
        attributes: ['id', 'name', 'weight', 'marks'],
      });
      const subjectTotalWeight = subjectAssessments.reduce((sum, assessment) => sum + parseFloat(assessment.weight), 0);
      return {
        subjectId: subject.subjectId,
        subjectName: subject.Subject.name,
        subjectTotalWeight,
        subjectAssessments
      };
    }));

    // // Define a function to fetch grade and remarks based on totalScore
    // const getGradeAndRemarks = async (totalScore) => {
    //   const grading = await GradingSystem.findOne({
    //     where: {
    //       minScore: { [Op.lte]: totalScore },
    //       maxScore: { [Op.gte]: totalScore }
    //     }
    //   });
    //   return grading ? { grade: grading.grade, remarks: grading.remarks } : { grade: 'N/A', remarks: 'N/A' };
    // };

    // Process the students and their grades
    const classStudents = await Promise.all(students.map(async (student) => {
      if (!student.Student) {
        return null;
      }

      let totalScore = 0;
      const subjectScores = await Promise.all(subjectTotalWeights.map(async (subject) => {
        let subjectScore = 0;
        const grades = await Grade.findAll({
          where: {
            studentId: student.Student.id,
            assessmentId: {
              [Op.in]: subject.subjectAssessments.map(assessment => assessment.id)
            }
          },
          include: {
            model: Assessment,
            attributes: ['weight', 'marks', 'name']
          }
        });

        subject.subjectAssessments.forEach(assessment => {
          const grade = grades.find(g => g.assessmentId === assessment.id);
          const score = grade ? parseFloat(grade.score) : 0;
          const weightedScore = grade ? (score / parseFloat(grade.Assessment.marks)) * parseFloat(grade.Assessment.weight) : 0;
          subjectScore += weightedScore;
        });

        const { grade, remarks } = await getGradeAndRemarks(subjectScore.toFixed(2));
        totalScore += subjectScore;
        return {
          name: subject.subjectName,
          score: subjectScore.toFixed(2),
          grade,
          remarks
        };
      }));

      return {
        studentId: student.Student.id,
        fullName: student.Student.middleName
          ? `${student.Student.firstName} ${student.Student.middleName} ${student.Student.lastName}`
          : `${student.Student.firstName} ${student.Student.lastName}`,
        photo: student.Student.passportPhoto,
        subjectScores: subjectScores,
        totalScore: totalScore.toFixed(2)
      };
    }));

    // Filter out any null values from the results
    const filteredClassStudents = classStudents.filter(student => student !== null);

    // Sort students by totalScore in descending order and assign positions
    filteredClassStudents.sort((a, b) => b.totalScore - a.totalScore);

    filteredClassStudents.forEach((student, index) => {
      const position = index + 1;
      let suffix = 'th';
      if (position % 10 === 1 && position % 100 !== 11) {
        suffix = 'st';
      } else if (position % 10 === 2 && position % 100 !== 12) {
        suffix = 'nd';
      } else if (position % 10 === 3 && position % 100 !== 13) {
        suffix = 'rd';
      }
      student.position = `${position}${suffix}`;
    });

    return {
      totalWeight: subjectTotalWeights.reduce((sum, subject) => sum + subject.subjectTotalWeight, 0),
      subjects: subjectTotalWeights.map(subject => ({
        id: subject.subjectId,
        name: subject.subjectName,
        subjectWeight: subject.subjectTotalWeight
      })),
      classStudents: filteredClassStudents
    };
  } catch (error) {
    console.error('Error fetching class results:', error);
    return null;
  }
};
const fetchClassResults = async (academicTermId, classSessionId) => {
  try {
    const section = await Section.findByPk(classSessionId);
    const term = await AcademicTerm.findByPk(academicTermId);

    if (!section) throw new Error("Class section not found!");
    if (!term) throw new Error("Academic term not found!");

    // Fetching class students
    const students = await ClassStudent.findAll({
      where: {
        classSessionId,
        academicYearId: term.academicYearId
      },
      include: {
        model: Student,
        attributes: ['id', 'firstName', 'middleName', 'lastName', 'passportPhoto'],
      }
    });

    // Fetch all class subjects
    const subjects = await ClassSubject.findAll({
      where: { classId: section.classId },
      include: [
        {
          model: Subject,
          attributes: ['id', 'name'],
          order: [['name', 'ASC']]
        },
      ],
    });

    // Calculate total assessments weight for each subject
    const subjectTotalWeights = await Promise.all(subjects.map(async (subject) => {
      const subjectAssessments = await Assessment.findAll({
        where: {
          subjectId: subject.subjectId,
          classSessionId,
          academicTermId
        },
        attributes: ['id', 'name', 'weight', 'marks'],
      });
      const subjectTotalWeight = subjectAssessments.reduce((sum, assessment) => sum + parseFloat(assessment.weight), 0);
      return {
        subjectId: subject.subjectId,
        subjectName: subject.Subject.name,
        subjectTotalWeight,
        subjectAssessments
      };
    }));

    // Process the students and their grades
    const classStudents = await Promise.all(students.map(async (student) => {
      if (!student.Student) {
        return null;
      }

      let totalScore = 0;
      const subjectScores = await Promise.all(subjectTotalWeights.map(async (subject) => {
        let subjectScore = 0;
        const grades = await Grade.findAll({
          where: {
            studentId: student.Student.id,
            assessmentId: {
              [Op.in]: subject.subjectAssessments.map(assessment => assessment.id)
            }
          },
          include: {
            model: Assessment,
            attributes: ['weight', 'marks', 'name']
          }
        });

        subject.subjectAssessments.forEach(assessment => {
          const grade = grades.find(g => g.assessmentId === assessment.id);
          const score = grade ? parseFloat(grade.score) : 0;
          const weightedScore = grade ? (score / parseFloat(grade.Assessment.marks)) * parseFloat(grade.Assessment.weight) : 0;
          subjectScore += weightedScore;
        });

        const { grade, remarks } = await getGradeAndRemarks(subjectScore.toFixed(2));
        totalScore += subjectScore;
        return {
          subjectId: subject.subjectId,
          name: subject.subjectName,
          score: subjectScore.toFixed(2),
          grade,
          remarks
        };
      }));

      return {
        studentId: student.Student.id,
        fullName: student.Student.middleName
          ? `${student.Student.firstName} ${student.Student.middleName} ${student.Student.lastName}`
          : `${student.Student.firstName} ${student.Student.lastName}`,
        photo: student.Student.passportPhoto,
        subjectScores: subjectScores,
        totalScore: totalScore.toFixed(2)
      };
    }));

    // Filter out any null values from the results
    const filteredClassStudents = classStudents.filter(student => student !== null);

    // Sort students by totalScore in descending order and assign positions
    filteredClassStudents.sort((a, b) => b.totalScore - a.totalScore);

    filteredClassStudents.forEach((student, index) => {
      const position = index + 1;
      let suffix = 'th';
      if (position % 10 === 1 && position % 100 !== 11) {
        suffix = 'st';
      } else if (position % 10 === 2 && position % 100 !== 12) {
        suffix = 'nd';
      } else if (position % 10 === 3 && position % 100 !== 13) {
        suffix = 'rd';
      }
      student.position = `${position}${suffix}`;
    });

    // Calculate subject positions
    subjectTotalWeights.forEach(subject => {
      const subjectScores = filteredClassStudents.map(student => ({
        studentId: student.studentId,
        score: student.subjectScores.find(s => s.subjectId === subject.subjectId).score
      })).sort((a, b) => b.score - a.score);

      subjectScores.forEach((subjectScore, index) => {
        const position = index + 1;
        let suffix = 'th';
        if (position % 10 === 1 && position % 100 !== 11) {
          suffix = 'st';
        } else if (position % 10 === 2 && position % 100 !== 12) {
          suffix = 'nd';
        } else if (position % 10 === 3 && position % 100 !== 13) {
          suffix = 'rd';
        }
        const student = filteredClassStudents.find(s => s.studentId === subjectScore.studentId);
        const subjectDetail = student.subjectScores.find(s => s.subjectId === subject.subjectId);
        subjectDetail.position = `${position}${suffix}`;
      });
    });

    return {
      totalWeight: subjectTotalWeights.reduce((sum, subject) => sum + subject.subjectTotalWeight, 0),
      subjects: subjectTotalWeights.map(subject => ({
        id: subject.subjectId,
        name: subject.subjectName,
        subjectWeight: subject.subjectTotalWeight
      })),
      classStudents: filteredClassStudents
    };
  } catch (error) {
    console.error('Error fetching class results:', error);
    return null;
  }
};


// Fetch students results for a class section subjects a particular academic term
exports.classStudentsResults = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const { academicTermId, classSessionId } = req.params;

      const section = await Section.findByPk(classSessionId);
      const term = await AcademicTerm.findByPk(academicTermId);

      if (!section) return res.status(400).json({ message: "Class section not found!" });
      if (!term) return res.status(400).json({ message: "Academic term not found!" });

      // Fetching class students
      const students = await ClassStudent.findAll({
        where: {
          classSessionId,
          academicYearId: term.academicYearId
        },
        include: {
          model: Student,
          attributes: ['id', 'firstName', 'middleName', 'lastName', 'passportPhoto'],
        }
      });

      // Fetch all class subjects
      const subjects = await ClassSubject.findAll({
        where: { classId: section.classId },
        include: [
          {
            model: Subject,
            attributes: ['id', 'name'],
            order: [['name', 'ASC']]
          },
        ],
      });

      // Calculate total assessments weight for each subject
      const subjectTotalWeights = await Promise.all(subjects.map(async (subject) => {
        const subjectAssessments = await Assessment.findAll({
          where: {
            subjectId: subject.subjectId,
            classSessionId,
            academicTermId
          },
          attributes: ['id', 'name', 'weight', 'marks'],
        });
        const subjectTotalWeight = subjectAssessments.reduce((sum, assessment) => sum + parseFloat(assessment.weight), 0);
        return {
          subjectId: subject.subjectId,
          subjectName: subject.Subject.name,
          subjectTotalWeight,
          subjectAssessments
        };
      }));

      // Process the students and their grades
      const classStudents = await Promise.all(students.map(async (student) => {
        if (!student.Student) {
          return null;
        }

        let totalScore = 0;
        const subjectScores = await Promise.all(subjectTotalWeights.map(async (subject) => {
          let subjectScore = 0;
          const grades = await Grade.findAll({
            where: {
              studentId: student.Student.id,
              assessmentId: {
                [Op.in]: subject.subjectAssessments.map(assessment => assessment.id)
              }
            },
            include: {
              model: Assessment,
              attributes: ['weight', 'marks', 'name']
            }
          });

          subject.subjectAssessments.forEach(assessment => {
            const grade = grades.find(g => g.assessmentId === assessment.id);
            const score = grade ? parseFloat(grade.score) : 0;
            const weightedScore = grade ? (score / parseFloat(grade.Assessment.marks)) * parseFloat(grade.Assessment.weight) : 0;
            subjectScore += weightedScore;
          });

          const { grade, remarks } = await getGradeAndRemarks(subjectScore.toFixed(2));
          totalScore += subjectScore;
          return {
            name: subject.subjectName,
            score: subjectScore.toFixed(2),
            grade,
            remarks
          };
        }));

        return {
          studentId: student.Student.id,
          fullName: student.Student.middleName
            ? `${student.Student.firstName} ${student.Student.middleName} ${student.Student.lastName}`
            : `${student.Student.firstName} ${student.Student.lastName}`,
          photo: student.Student.passportPhoto,
          subjectScores: subjectScores,
          totalScore: totalScore.toFixed(2)
          // grade: grade,
          // remarks: remarks
        };
      }));

      // Filter out any null values from the results
      const filteredClassStudents = classStudents.filter(student => student !== null);

      // Sort students by totalScore in descending order and assign positions
      filteredClassStudents.sort((a, b) => b.totalScore - a.totalScore);

      filteredClassStudents.forEach((student, index) => {
        const position = index + 1;
        let suffix = 'th';
        if (position % 10 === 1 && position % 100 !== 11) {
          suffix = 'st';
        } else if (position % 10 === 2 && position % 100 !== 12) {
          suffix = 'nd';
        } else if (position % 10 === 3 && position % 100 !== 13) {
          suffix = 'rd';
        }
        student.position = `${position}${suffix}`;
      });

      const result = {
        totalWeight: subjectTotalWeights.reduce((sum, subject) => sum + subject.subjectTotalWeight, 0),
        subjects: subjectTotalWeights.map(subject => ({
          id: subject.subjectId,
          name: subject.subjectName,
          subjectWeight: subject.subjectTotalWeight
        })),
        classStudents: filteredClassStudents
      };

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching students assessments:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Fetch a single student results for a particular academic term
exports.singleStudentResult1 = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const { studentId, classSessionId, academicTermId } = req.params;

      // Fetch the class results first
      const classResults = await fetchClassResults(academicTermId, classSessionId);

      if (!classResults) 
        return res.status(400).json({ message: "Class results not found!" });

      // Find the specific student result
      const studentResult = classResults.classStudents.find(student => student.studentId == studentId);

      if (!studentResult) 
        return res.status(404).json({ message: "Student result not found!" });

      return res.status(200).json(studentResult);
    } catch (error) {
      console.error('Error fetching student result:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

exports.singleStudentResult = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const { studentId, classSessionId, academicTermId } = req.params;

      // Fetch the class results first
      const classResults = await fetchClassResults(academicTermId, classSessionId);

      if (!classResults) 
        return res.status(400).json({ message: "Class results not found!" });

      // Find the specific student result
      const studentResult = classResults.classStudents.find(student => student.studentId == studentId);

      if (!studentResult) 
        return res.status(404).json({ message: "Student result not found!" });

      return res.status(200).json(studentResult);
    } catch (error) {
      console.error('Error fetching student result:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};


module.exports = {
  getGradeAndRemarks,
  classStudentsResults: exports.classStudentsResults,
  singleStudentResult: exports.singleStudentResult,
};







