'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ClassStudents', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
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
      academicYearId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'AcademicYears', 
          key: 'id'
        },
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'  
      },
      status: {
        type: Sequelize.STRING
      },
      promotedTo: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Sections', 
          key: 'id'
        },
        onDelete: 'SET NULL', 
        onUpdate: 'CASCADE'  
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
    await queryInterface.dropTable('ClassStudents');
  }
};