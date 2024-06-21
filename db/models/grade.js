'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Grade extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.Assessment, { foreignKey: 'assessmentId', onDelete: 'CASCADE', onUpdate:'CASCADE'  });
      this.belongsTo(models.Student, { foreignKey: 'studentId', onDelete: 'CASCADE', onUpdate:'CASCADE' });
    }
  }
  Grade.init({
    assessmentId: { type: DataTypes.INTEGER, allowNull: false },
    studentId: { type: DataTypes.INTEGER, allowNull: false },
    score: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
    total: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  }, {
    sequelize,
    modelName: 'Grade',
  });
  return Grade;
};