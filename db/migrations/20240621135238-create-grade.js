'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Grades', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      assessmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Assessments', 
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
      score: {
        type: Sequelize.DECIMAL
      },
      // total: {
      //   type: Sequelize.DECIMAL
      // },
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
    await queryInterface.dropTable('Grades');
  }
};