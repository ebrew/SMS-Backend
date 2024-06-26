'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Students', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      firstName: {
        type: Sequelize.STRING
      },
      middleName: {
        type: Sequelize.STRING
      },
      lastName: {
        type: Sequelize.STRING
      },
      email: {
        type: Sequelize.STRING
      },
      phone: {
        type: Sequelize.STRING
      },
      address: {
        type: Sequelize.STRING
      },
      role: {
        type: Sequelize.STRING
      },
      studentID: {
        type: Sequelize.STRING
      },
      dob: {
        type: Sequelize.DATE
      },
      gender: {
        type: Sequelize.STRING
      },
      nationality: {
        type: Sequelize.STRING
      },
      passportPhoto: {
        type: Sequelize.JSON
      },
      parentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Parents', 
          key: 'id'
        },
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'  
      },
      emergencyName: {
        type: Sequelize.STRING
      },
      emergencyTitle: {
        type: Sequelize.STRING
      },
      emergencyAddress: {
        type: Sequelize.STRING
      },
      emergencyPhone: {
        type: Sequelize.STRING
      },
      password: {
        type: Sequelize.STRING
      },
      resetToken: {
        type: Sequelize.STRING
      },
      resetTokenExpiration: {
        type: Sequelize.DATE
      },
      isPasswordReset: {
        type: Sequelize.BOOLEAN
      },
      departmentId: {
        type: Sequelize.INTEGER
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
    await queryInterface.dropTable('Students');
  }
};