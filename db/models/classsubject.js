'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ClassSubject extends Model {
    static associate(models) {
      this.belongsTo(models.ClassSubject, { foreignKey: 'classId', onDelete: 'CASCADE', onUpdate:'CASCADE'  });
      this.belongsTo(models.ClassSubject, { foreignKey: 'subjectId', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
    }
  }
  ClassSubject.init({
    classId: { type: DataTypes.INTEGER, allowNull: false },
    subjectId: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    sequelize,
    modelName: 'ClassSubject',
  });
  return ClassSubject;
};