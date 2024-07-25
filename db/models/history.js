'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class History extends Model {
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
  History.init({
    userId: { type: DataTypes.INTEGER, allowNull: true },
    studentId: { type: DataTypes.INTEGER, allowNull: true },
    action: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true},
  }, {
    sequelize,
    modelName: 'History',
  });
  return History;
};