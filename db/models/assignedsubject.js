'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class AssignedSubject extends Model {
    static associate(models) {
      this.belongsTo(models.AssignedTeacher, { foreignKey: 'assignedTeacherId', onDelete: 'CASCADE', onUpdate:'CASCADE'  });
      this.belongsTo(models.Subject, { foreignKey: 'subjectId', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });

    }
  }
  AssignedSubject.init({
    assignedTeacherId: { type: DataTypes.INTEGER, allowNull: false },
    subjectId: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    sequelize,
    modelName: 'AssignedSubject',
  });
  return AssignedSubject;
};