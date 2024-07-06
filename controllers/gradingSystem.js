require('dotenv').config();
var express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op, or, and, where } = require('sequelize');
const passport = require('../db/config/passport')
const { User, Student, GradingSystem } = require("../db/models/index")
const Mail = require('../utility/email');

// Create a new Grading point
exports.addGradePoint = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const { minScore, maxScore, grade, remarks } = req.body;

      // Check for missing fields
      if (minScore == null || maxScore == null || !grade || !remarks) {
        return res.status(400).json({ message: 'Incomplete field!' });
      }

      // Check if grade already exists
      const existingGrade = await GradingSystem.findOne({
        where: { grade }
      });

      if (existingGrade) {
        return res.status(400).json({ message: 'Grade already exists!' });
      }

      // Check for overlapping grade points
      const overlappingGradePoint = await GradingSystem.findOne({
        where: {
          [Op.or]: [
            {
              minScore: {
                [Op.between]: [minScore, maxScore]
              }
            },
            {
              maxScore: {
                [Op.between]: [minScore, maxScore]
              }
            },
            {
              [Op.and]: [
                {
                  minScore: {
                    [Op.lte]: minScore
                  }
                },
                {
                  maxScore: {
                    [Op.gte]: maxScore
                  }
                }
              ]
            }
          ]
        }
      });

      if (overlappingGradePoint) {
        return res.status(400).json({ message: 'Grade point range overlaps with an existing grade point!' });
      }

      // Create the new grading point
      await GradingSystem.create({ minScore, maxScore, grade, remarks });
      return res.status(200).json({ message: 'Grading point created successfully!' });

    } catch (error) {
      console.error('Error creating grading point:', error);
      return res.status(500).json({ message: "Can't create grading point at the moment!" });
    }
  });
};

// Update an already created GradePoint
exports.updateGradePoint = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const { minScore, maxScore, grade, remarks } = req.body;
      const id = req.params.id;

      // Check for missing fields
      if (minScore == null || maxScore == null || !grade || !remarks) {
        return res.status(400).json({ message: 'Incomplete field!' });
      }

      const gradePoint = await GradingSystem.findByPk(id);

      if (!gradePoint) {
        return res.status(400).json({ message: 'GradePoint not found!' });
      }

      // Check for overlapping grade points
      const overlappingGradePoint = await GradingSystem.findOne({
        where: {
          id: { [Op.ne]: id }, // Exclude the current grade point
          [Op.or]: [
            {
              minScore: {
                [Op.between]: [minScore, maxScore]
              }
            },
            {
              maxScore: {
                [Op.between]: [minScore, maxScore]
              }
            },
            {
              [Op.and]: [
                {
                  minScore: {
                    [Op.lte]: minScore
                  }
                },
                {
                  maxScore: {
                    [Op.gte]: maxScore
                  }
                }
              ]
            }
          ]
        }
      });

      if (overlappingGradePoint) {
        return res.status(400).json({ message: 'Grade point range overlaps with an existing grade point!' });
      }

      // Update grade point details
      gradePoint.minScore = minScore;
      gradePoint.maxScore = maxScore;
      gradePoint.grade = grade;
      gradePoint.remarks = remarks;
      await gradePoint.save();

      return res.status(200).json({ message: 'GradePoint updated successfully!' });

    } catch (error) {
      console.error('Error updating GradePoint:', error);
      return res.status(500).json({ message: "Can't update GradePoint at the moment!" });
    }
  });
};

// Delete Grade Point
exports.deleteGradePoint = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const id = req.params.id;

      // Check if the grade point exists
      const gradePoint = await GradingSystem.findByPk(id);

      if (!gradePoint) {
        return res.status(400).json({ message: 'Grade Point not found!' });
      }

      // Proceed to delete the grade point
      await gradePoint.destroy();

      return res.status(200).json({ message: 'Grade Point deleted successfully!' });
    } catch (error) {
      console.error('Error deleting Grade Point:', error);
      return res.status(500).json({ message: 'Cannot delete Grade Point at the moment' });
    }
  });
};

// Fetch all GradePoints in descending order of grade
exports.getAllGradePoints = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      // Fetch all grade points in descending order of grade
      const gradePoints = await GradingSystem.findAll({
        order: [['grade', 'DESC']]
      });

      return res.status(200).json({ gradePoints });
    } catch (error) {
      console.error('Error fetching grade points:', error);
      return res.status(500).json({ message: "Can't fetch grade points at the moment!" });
    }
  });
};


