'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ResetRequest extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'CASCADE', onUpdate:'CASCADE' });
      this.belongsTo(models.Student, { foreignKey: 'studentId', onDelete: 'CASCADE', onUpdate:'CASCADE'  });
    }
  }
  ResetRequest.init({
    isPasswordReset: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue:false}, // 
    userId: { type: DataTypes.INTEGER, allowNull: true },
    studentId: { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'ResetRequest',
  });
  return ResetRequest;
};