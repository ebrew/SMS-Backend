'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AssignedTeachers', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
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
      classId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Sections', 
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
    await queryInterface.dropTable('AssignedTeachers');
  }
};