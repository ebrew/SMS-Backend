'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class FeeType extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.hasMany(models.BillingDetail, { foreignKey: 'feeTypeId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    }
  }
  FeeType.init({
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING, allowNull: true },
  }, {
    sequelize,
    modelName: 'FeeType',
  });
  return FeeType;
};