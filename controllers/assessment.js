require('dotenv').config();
var express = require('express');
const { Op } = require('sequelize');
const passport = require('../db/config/passport')
const { Student, ClassStudent, AcademicYear, AcademicTerm, Assessment, Grade, GradingSystem } = require("../db/models/index")
const { getGradeAndRemarks } = require('../controllers/result');


// Create a new Assessment
exports.addAssessment = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const { name, description, academicTermId, teacherId, classSessionId, subjectId, weight, marks } = req.body;

      // Check for missing fields
      if (!name || !academicTermId || !teacherId || !classSessionId || !subjectId || weight === undefined || marks === undefined) {
        return res.status(400).json({ message: 'Incomplete field!' });
      }

      // Check if the assessment already exists
      const alreadyExist = await Assessment.findOne({
        where: {
          [Op.and]: [
            { name: { [Op.iLike]: name } },
            { academicTermId },
            { classSessionId },
            { subjectId },
          ],
        },
      });

      if (alreadyExist) {
        return res.status(400).json({ message: `${name} already exists!` });
      }

      // Sum the weights of existing assessments
      const totalWeight = parseFloat(await Assessment.sum('weight', {
        where: {
          academicTermId,
          classSessionId,
          subjectId,
        },
      }));

      // Check if adding the new weight exceeds 100%
      if ((totalWeight + parseFloat(weight)) > 100.00) {
        return res.status(400).json({ message: 'Total weight of assessments exceeds 100%!' });
      }

      // Create the new assessment
      await Assessment.create({ name, description, academicTermId, teacherId, classSessionId, subjectId, weight, marks });
      return res.status(200).json({ message: 'Assessment created successfully!' });

    } catch (error) {
      console.error('Error creating assessment:', error);
      return res.status(500).json({ message: "Can't create assessment at the moment!" });
    }
  });
};

// Update an already created Assessment
exports.updateAssessment = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const { name, description, academicTermId, classSessionId, subjectId, weight, marks } = req.body;
      const id = req.params.id;

      // Check for missing fields
      if (!name || !academicTermId || !classSessionId || !subjectId || weight === undefined || marks === undefined) {
        return res.status(400).json({ message: 'Incomplete field!' });
      }

      const assessment = await Assessment.findByPk(id);

      if (!assessment) {
        return res.status(400).json({ message: 'Assessment not found!' });
      }

      // If weight has changed, verify the total weight does not exceed 100
      if (assessment.weight !== weight) {
        // Sum the weights of existing assessments excluding the current one
        const totalWeight = parseFloat(await Assessment.sum('weight', {
          where: {
            academicTermId,
            classSessionId,
            subjectId,
            id: { [Op.ne]: id }, // Exclude the current assessment
          },
        }));

        if ((totalWeight + parseFloat(weight)) > 100.00) {
          return res.status(400).json({ message: 'Total weight of assessments exceeds 100%!' });
        }
      }

      // Update assessment details
      assessment.name = name;
      assessment.description = description;
      assessment.weight = weight;
      assessment.marks = marks;
      await assessment.save();

      return res.status(200).json({ message: 'Assessment updated successfully!' });

    } catch (error) {
      console.error('Error updating assessment:', error);
      return res.status(500).json({ message: "Can't update assessment at the moment!" });
    }
  });
};

// Delete assessment
exports.deleteAssessment = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const id = req.params.id;

      // Check if the assessment exists
      const assessment = await Assessment.findByPk(id);

      if (!assessment) {
        return res.status(400).json({ message: 'Assessment not found!' });
      }

      // Check if the assessment has associated grades
      const gradesCount = await Grade.count({ where: { assessmentId: id } });

      if (gradesCount > 0) {
        return res.status(400).json({ message: 'Cannot delete assessment as it has associated grades!' });
      }

      // Proceed to delete the assessment if no associated grades
      await assessment.destroy();

      return res.status(200).json({ message: 'Assessment deleted successfully!' });
    } catch (error) {
      console.error('Error deleting assessment:', error);
      return res.status(500).json({ message: 'Cannot delete assessment at the moment' });
    }
  });
};

// Get a particular subject assessment   
exports.getAssessment = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const id = req.params.id;

      const data = await Assessment.findByPk(id);

      if (!data) {
        return res.status(404).json({ message: 'Subject assessment not found!' });
      }

      return res.status(200).json({ 'assessment': data });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Get all subject assessments for active academic term
exports.allSubjectAssessments = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const { classSessionId, subjectId } = req.params;

      // Validate required parameters
      if (!classSessionId || !subjectId) {
        return res.status(400).json({ message: 'Incomplete fields!' });
      }

      // Find the active academic term and update its status if necessary
      let activeAcademicTerm = await AcademicTerm.findOne({ where: { status: 'Active' } });
      if (activeAcademicTerm)
        await activeAcademicTerm.setInactiveIfEndDateDue();

      activeAcademicTerm = await AcademicTerm.findOne({ where: { status: 'Active' } });
      if (!activeAcademicTerm)
        return res.status(400).json({ message: "No active academic term available!" });

      // Fetching class assessments
      const assessments = await Assessment.findAll({
        where: { classSessionId, academicTermId: activeAcademicTerm.id, subjectId },
        order: [['weight', 'DESC']],
      });

      return res.status(200).json({ assessments });
    } catch (error) {
      console.error('Error fetching assessments:', error.message);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Grade a student
exports.gradeStudent = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const { assessmentId, studentId, score } = req.body;

      // Validate required fields
      if (!assessmentId || !studentId || score === undefined) {
        return res.status(400).json({ message: 'Incomplete field!' });
      }

      // Check if the assessment exists
      const assessment = await Assessment.findByPk(assessmentId);
      if (!assessment) {
        return res.status(400).json({ message: 'Subject assessment not found!' });
      }

      // Ensure the score and assessment marks are numbers
      const assessmentMarks = parseFloat(assessment.marks);
      const studentScore = parseFloat(score);

      // Ensure the score does not exceed the assessment's marks
      if (studentScore > assessmentMarks) {
        return res.status(400).json({ message: `Score exceeds the maximum marks for this assessment! Maximum marks: ${assessmentMarks}` });
      }

      // Check if the student is already graded
      let alreadyExist = await Grade.findOne({ where: { assessmentId, studentId } });
      if (alreadyExist) {
        alreadyExist.score = studentScore;
        await alreadyExist.save();
        return res.status(200).json({ message: 'Student graded successfully!' });
      }

      // Create a new grade
      await Grade.create({ assessmentId, studentId, score: studentScore });
      return res.status(200).json({ message: 'Student graded successfully!' });

    } catch (error) {
      console.error('Error grading student:', error);
      return res.status(500).json({ message: "Can't grade student at the moment!" });
    }
  });
};

// Update student grade   || Not in use
exports.updateStudentGrade = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const { score } = req.body;
      const id = req.params.id;

      // Check for missing fields
      if (score === undefined) {
        return res.status(400).json({ message: 'Score is required!' });
      }

      const grade = await Grade.findByPk(id);

      if (!grade) {
        return res.status(400).json({ message: 'Student grade not found!' });
      }

      // If score has changed, ensure the score does not exceed the assessment's marks
      if (grade.score !== score) {
        const assessment = await Assessment.findByPk(grade.assessmentId);
        if (!assessment) {
          return res.status(400).json({ message: 'Associated assessment not found!' });
        }
        if (score > assessment.marks) {
          return res.status(400).json({ message: `Score exceeds the maximum marks for this assessment! Maximum marks: ${assessment.marks}` });
        }
      }

      // Update grade details
      grade.score = score;
      await grade.save();

      return res.status(200).json({ message: 'Grade updated successfully!' });

    } catch (error) {
      console.error('Error updating grade:', error);
      return res.status(500).json({ message: "Can't update grade at the moment!" });
    }
  });
};

// Students' grades for a particular assessment
exports.studentsAssessmentGrades = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const assessmentId = req.params.id;

      // Fetch the assessment details along with the academic term and year
      const assessment = await Assessment.findByPk(assessmentId, {
        include: {
          model: AcademicTerm,
          include: {
            model: AcademicYear,
            attributes: ['id'],
          },
        },
      });

      if (!assessment)
        return res.status(400).json({ message: "Assessment not found!" });

      const academicYearId = assessment.AcademicTerm.AcademicYear.id;

      // Fetching class students
      const students = await ClassStudent.findAll({
        where: {
          classSessionId: assessment.classSessionId,
          academicYearId: academicYearId
        },
        include: {
          model: Student,
          attributes: ['id', 'firstName', 'middleName', 'lastName', 'passportPhoto'],
        },
        order: [[{ model: Student }, 'firstName', 'ASC']],
      });

      // Process the students and their grades
      const classStudents = await Promise.all(students.map(async (student) => {
        if (!student.Student) {
          return null;
        }

        // Fetch assessment grade
        const score = await Grade.findOne({ where: { assessmentId, studentId: student.Student.id } });
        return {
          studentId: student.Student.id,
          fullName: student.Student.middleName
            ? `${student.Student.firstName} ${student.Student.middleName} ${student.Student.lastName}`
            : `${student.Student.firstName} ${student.Student.lastName}`,
          photo: student.Student.passportPhoto,
          score: score ? score.score : null,
          weight: score ? ((parseFloat(score.score) / parseFloat(assessment.marks)) * parseFloat(assessment.weight)).toFixed(2) : null
        };
      }));

      // Filter out any null values from the results
      const filteredClassStudents = classStudents.filter(student => student !== null);

      const result = {
        assessmentId: assessmentId,
        weight: assessment.weight,
        marks: assessment.marks,
        classStudents: filteredClassStudents
      };

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching teacher class students assessment:', error);
      return res.status(500).json({ message: "Can't fetch data at the moment!" });
    }
  });
};

// Students' grades for a particular subject's assessments
exports.subjectAssessmentsGrades = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const { academicTermId, classSessionId, subjectId } = req.params;

      // Fetch the assessments details along with the academic term and year
      const assessments = await Assessment.findAll({
        where: {
          subjectId,
          classSessionId,
          academicTermId
        },
        attributes: ['id', 'name', 'weight', 'marks'],
        include: {
          model: AcademicTerm,
          include: {
            model: AcademicYear,
            attributes: ['id'],
          },
        },
      });

      if (assessments.length === 0)
        return res.status(400).json({ message: "No assessment made for the academic term!" });

      const academicYearId = assessments[0].AcademicTerm.AcademicYear.id;

      // Fetching class students
      const students = await ClassStudent.findAll({
        where: {
          classSessionId,
          academicYearId
        },
        include: {
          model: Student,
          attributes: ['id', 'firstName', 'middleName', 'lastName', 'passportPhoto'],
        },
        order: [[{ model: Student }, 'firstName', 'ASC']],
      });

      const subjectTotalWeight = assessments.reduce((sum, assessment) => sum + parseFloat(assessment.weight), 0);

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

        let assessmentScore = 0;
        const assessmentsScores = [];

        // Fetch grades for each student's assessments in the specified subject
        const grades = await Grade.findAll({
          where: {
            studentId: student.Student.id,
            assessmentId: {
              [Op.in]: assessments.map(assessment => assessment.id)
            }
          },
          include: {
            model: Assessment,
            attributes: ['weight', 'marks', 'name']
          }
        });

        // Calculate total marks and assessment score
        assessments.forEach(assessment => {
          const grade = grades.find(g => g.assessmentId === assessment.id);
          const score = grade ? parseFloat(grade.score) : 0;
          const weightedScore = grade ? (score / parseFloat(grade.Assessment.marks)) * parseFloat(grade.Assessment.weight) : 0;

          assessmentScore += weightedScore;

          assessmentsScores.push({
            name: assessment.name,
            score: weightedScore
          });
        });

        const totalScore = assessmentScore.toFixed(2);
        const { grade, remarks } = await getGradeAndRemarks(totalScore);

        return {
          studentId: student.Student.id,
          fullName: student.Student.middleName
            ? `${student.Student.firstName} ${student.Student.middleName} ${student.Student.lastName}`
            : `${student.Student.firstName} ${student.Student.lastName}`,
          photo: student.Student.passportPhoto,
          assessmentsScores: assessmentsScores,
          totalScore: totalScore,
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
        subjectTotalWeight: subjectTotalWeight,
        assessments: assessments.map(assessment => ({
          id: assessment.id,
          name: assessment.name,
          weight: assessment.weight,
          marks: assessment.marks
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



