require('dotenv').config();
const { Op } = require('sequelize');
const passport = require('../db/config/passport')
const { Student, ClassStudent, AcademicYear, AcademicTerm, Assessment, Grade, GradingSystem, Subject, Class, Section } = require("../db/models/index")


// Fetch students results for a class section subjects for a particular academic term
exports.classStudentsResults = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const { academicTermId, classSessionId } = req.params;

      const section = await Section.findByPk(classSessionId);
      const term = await AcademicTerm.findByPk(academicTermId);

      if (!section)
        return res.status(400).json({ message: "Class section not found!" });
      if (!term)
        return res.status(400).json({ message: "Academic term not found!" });

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
      const subjectsWithWeights = await Promise.all(subjects.map(async (subject) => {
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
          id: subject.Subject.id,
          name: subject.Subject.name,
          subjectWeight: subjectTotalWeight,
          assessments: subjectAssessments
        };
      }));

      const totalWeight = subjectsWithWeights.reduce((sum, subject) => sum + subject.subjectWeight, 0);

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

      // Process the students and their grades
      const classStudents = await Promise.all(students.map(async (student) => {
        if (!student.Student) {
          return null;
        }

        const subjectScores = await Promise.all(subjectsWithWeights.map(async (subject) => {
          let assessmentScore = 0;

          // Fetch grades for each student's assessments in the specified subject
          const grades = await Grade.findAll({
            where: {
              studentId: student.Student.id,
              assessmentId: {
                [Op.in]: subject.assessments.map(assessment => assessment.id)
              }
            },
            include: {
              model: Assessment,
              attributes: ['weight', 'marks', 'name']
            }
          });

          // Calculate total marks and assessment score
          subject.assessments.forEach(assessment => {
            const grade = grades.find(g => g.assessmentId === assessment.id);
            const score = grade ? parseFloat(grade.score) : 0;
            const weightedScore = grade ? (score / parseFloat(grade.Assessment.marks)) * parseFloat(grade.Assessment.weight) : 0;
            assessmentScore += weightedScore;
          });

          return {
            name: subject.name,
            score: assessmentScore.toFixed(2)
          };
        }));

        const totalScore = subjectScores.reduce((sum, subjectScore) => sum + parseFloat(subjectScore.score), 0);
        const { grade, remarks } = await getGradeAndRemarks(totalScore);

        return {
          studentId: student.Student.id,
          fullName: student.Student.middleName
            ? `${student.Student.firstName} ${student.Student.middleName} ${student.Student.lastName}`
            : `${student.Student.firstName} ${student.Student.lastName}`,
          photo: student.Student.passportPhoto,
          subjectScores: subjectScores,
          totalScore: totalScore.toFixed(2),
          grade: grade,
          remarks: remarks
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
        totalWeight: totalWeight,
        subjects: subjectsWithWeights.map(subject => ({
          id: subject.id,
          name: subject.name,
          subjectWeight: subject.subjectWeight
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



