'use strict';
const {
  Model
} = require('sequelize');
const { v4: uuidv4 } = require('uuid');
module.exports = (sequelize, DataTypes) => {
  class Billing extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.Student, { foreignKey: 'studentId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
      this.belongsTo(models.AcademicYear, { foreignKey: 'academicYearId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
      this.belongsTo(models.AcademicTerm, { foreignKey: 'academicTermId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
      this.hasMany(models.BillingDetail, { foreignKey: 'billingId', onDelete: 'CASCADE', onUpdate:'CASCADE'  }); 
      this.hasMany(models.Payment, { foreignKey: 'billingId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    }
  }
  Billing.init({
    studentId: { type: DataTypes.INTEGER, allowNull: false },
    academicTermId: { type: DataTypes.INTEGER, allowNull: true },
    academicYearId: { type: DataTypes.INTEGER, allowNull: false },
    invoiceNumber: { type: DataTypes.STRING, allowNull: false, defaultValue: () => uuidv4() }, // Generate a unique invoice number
    totalFees: { type: DataTypes.FLOAT, allowNull: false },
    totalPaid: { type: DataTypes.FLOAT, defaultValue: 0 },
    remainingAmount: { type: DataTypes.FLOAT, allowNull: false }
  }, {
    sequelize,
    modelName: 'Billing',
  });
  return Billing;
};
