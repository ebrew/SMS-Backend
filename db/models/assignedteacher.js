'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class AssignedTeacher extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'teacherId', onDelete: 'CASCADE', onUpdate:'CASCADE'  });
      this.belongsTo(models.Section, { foreignKey: 'classId', onDelete: 'CASCADE', onUpdate:'CASCADE'  });
      this.hasMany(models.AssignedSubject, { foreignKey: 'assignedTeacherId', onDelete: 'CASCADE', onUpdate: 'CASCADE' }); 
    }
  }
  AssignedTeacher.init({
    teacherId: { type: DataTypes.INTEGER, allowNull: false },
    classId: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    sequelize,
    modelName: 'AssignedTeacher',
  });
  return AssignedTeacher;
};
