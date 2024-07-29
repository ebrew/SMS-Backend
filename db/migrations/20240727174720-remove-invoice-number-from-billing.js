'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // await queryInterface.addColumn('ClassStudents', 'promotedTo', {
    //   type: Sequelize.INTEGER,
    //   allowNull: true,
    //   references: {
    //     model: 'Sections',
    //     key: 'id'
    //   },
    //   onUpdate: 'SET NULL',
    //   onDelete: 'CASCADE'
    // });
    await queryInterface.removeColumn('Billings', 'invoiceNumber');
  },

  async down (queryInterface, Sequelize) {
    // await queryInterface.removeColumn('ClassStudents', 'promotedToClassSessionId');
    await queryInterface.addColumn('Billings', 'invoiceNumber', {
      type: Sequelize.STRING,
      allowNull: true
    });
  }
};
