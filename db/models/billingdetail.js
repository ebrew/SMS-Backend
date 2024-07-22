'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class BillingDetail extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.Billing, { foreignKey: 'billingId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
      this.belongsTo(models.FeeType, { foreignKey: 'feeTypeId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    }
  }
  BillingDetail.init({
    billingId: { type: DataTypes.INTEGER, allowNull: false },
    feeTypeId: { type: DataTypes.INTEGER, allowNull: false },
    amount: { type: DataTypes.FLOAT, allowNull: false },
  }, {
    sequelize,
    modelName: 'BillingDetail',
  });
  return BillingDetail;
};