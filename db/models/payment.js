'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Payment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.Billing, { foreignKey: 'billingId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    }
  }
  Payment.init({
    studentId: { type: DataTypes.INTEGER, allowNull: false },
    billingId: { type: DataTypes.INTEGER, allowNull: false },
    amount: { type: DataTypes.FLOAT, allowNull: false },
    date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, allowNull: false },
    method: { type: DataTypes.STRING, allowNull: false }
    // method: { type: DataTypes.ENUM('Cash', 'Card', 'Bank Transfer', 'Mobile Money'), allowNull: false },
  }, {
    sequelize,
    modelName: 'Payment',
  });
  return Payment;
};