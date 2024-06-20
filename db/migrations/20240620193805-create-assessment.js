'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Assessments', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING
      },
      description: {
        type: Sequelize.STRING
      },
      academicTermId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'AcademicTerms', 
          key: 'id'
        },
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'  
      },
      studentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Students', 
          key: 'id'
        },
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'  
      },
      teacherId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users', 
          key: 'id'
        },
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'  
      },
      classSessionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Sections', 
          key: 'id'
        },
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'  
      },
      subjectId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Subjects', 
          key: 'id'
        },
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'  
      },
      weight: {
        type: Sequelize.DECIMAL
      },
      marks: {
        type: Sequelize.DECIMAL
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Assessments');
  }
};