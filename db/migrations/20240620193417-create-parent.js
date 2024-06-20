'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Parents', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      fullName: {
        type: Sequelize.STRING
      },
      title: {
        type: Sequelize.STRING
      },
      relationship: {
        type: Sequelize.STRING
      },
      address: {
        type: Sequelize.STRING
      },
      email: {
        type: Sequelize.STRING
      },
      phone: {
        type: Sequelize.STRING
      },
      homePhone: {
        type: Sequelize.STRING
      },
      role: {
        type: Sequelize.STRING
      },
      occupation: {
        type: Sequelize.STRING
      },
      employer: {
        type: Sequelize.STRING
      },
      employerAddress: {
        type: Sequelize.STRING
      },
      workPhone: {
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
    await queryInterface.dropTable('Parents');
  }
};