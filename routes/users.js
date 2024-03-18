
const { Student, Enrollment, Class } = require('../models'); 

async function automatePromotion(currentAcademicYear) {
  try {
    // Identify eligible students for promotion (you need to define your criteria)
    const eligibleStudents = await Student.findAll({
      // Your criteria for eligibility
    });

    // For each eligible student, determine the next class and enroll for the next academic year
    for (const student of eligibleStudents) {
      const currentEnrollment = await Enrollment.findOne({
        where: {
          StudentID: student.StudentID,
          AcademicYear: currentAcademicYear,
        },
      });

      const currentClass = await Class.findByPk(currentEnrollment.ClassID);

      // Implement your logic to determine the next class based on grades, etc.
      const nextClass = await Class.findOne({
        where: {
          Grade: currentClass.Grade + 1,
        },
      });

      // Enroll the student for the next academic year and class
      await Enrollment.create({
        StudentID: student.StudentID,
        ClassID: nextClass.ClassID,
        AcademicYear: `${currentAcademicYear + 1}-${currentAcademicYear + 2}`,
      });
    }

    console.log('Automated promotion completed.');
  } catch (error) {
    console.error('Error during automated promotion:', error);
  }
}

// Usage example
automatePromotion('2023-2024'); // Call this function at the end of the academic year (e.g., after final exams)



const { Model, DataTypes } = require('sequelize');
const { Op } = require('sequelize');
const sequelize = require('../config/database'); // Assuming you have a database configuration

class AcademicYear extends Model {}

AcademicYear.init(
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active',
    },
  },
  {
    sequelize,
    modelName: 'AcademicYear',
  }
);


AcademicYear.beforeSave(async (academicYear) => {
  // Check if the current date is past the end date
  if (new Date() > academicYear.endDate) {
    // If so, update the status to 'inactive'
    academicYear.status = 'inactive';
  }
});





const { Class, Section } = require('../models');

// Function to fetch class data with associated sections
const fetchClassData = async (classId) => {
  try {
    const classWithSections = await Class.findOne({
      where: { id: classId },
      include: {
        model: Section,
        attributes: ['name', 'capacity'],
      },
    });

    if (!classWithSections) {
      return null; // Class not found
    }

    // Extract relevant data for response
    const {
      id,
      name,
      grade,
      headTeacher,
      createdAt,
      updatedAt,
      Sections, // The associated sections
    } = classWithSections.toJSON();

    // Format the response
    const formattedResponse = {
      id,
      name,
      grade,
      headTeacher,
      createdAt,
      updatedAt,
      sections: Sections.map(section => ({
        name: section.name,
        capacity: section.capacity,
      })),
    };

    return formattedResponse;
  } catch (error) {
    console.error('Error fetching class data:', error);
    throw error; // Handle the error appropriately
  }
};

// Example usage
// const classId = 1; // Replace with the actual classId you want to fetch
// const fetchedData = await fetchClassData(classId);

// Log or send the fetched data as needed
console.log('Fetched Data:', fetchedData);