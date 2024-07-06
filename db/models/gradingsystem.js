'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class GradingSystem extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  GradingSystem.init({
    minScore: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
    maxScore: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
    grade: { type: DataTypes.STRING, allowNull: false },
    remarks: { type: DataTypes.STRING, allowNull: false },
  }, {
    sequelize,
    modelName: 'GradingSystem',
  });
  return GradingSystem;
};