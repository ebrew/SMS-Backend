'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('ClassStudents', 'promotedTo', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'Sections', 
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('ClassStudents', 'promotedToClassSessionId');
  }
};
