'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ClassSubjects', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      classId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Classes', 
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
    await queryInterface.dropTable('ClassSubjects');
  }
};