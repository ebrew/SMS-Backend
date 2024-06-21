'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Assessment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.AcademicTerm, { foreignKey: 'academicTermId', onDelete: 'CASCADE', onUpdate:'CASCADE' });
      this.belongsTo(models.User, { foreignKey: 'teacherId', onDelete: 'CASCADE', onUpdate:'CASCADE'  });
      this.belongsTo(models.Section, { foreignKey: 'classSessionId', onDelete: 'CASCADE', onUpdate:'CASCADE' });
      this.belongsTo(models.Subject, { foreignKey: 'subjectId', onDelete: 'CASCADE', onUpdate:'CASCADE' });
      this.hasMany(models.Grade, { foreignKey: 'assessmentId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    }
  }
  Assessment.init({
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING, allowNull: false },
    academicTermId: { type: DataTypes.INTEGER, allowNull: false },
    teacherId: { type: DataTypes.INTEGER, allowNull: false },
    classSessionId: { type: DataTypes.INTEGER, allowNull: false },
    subjectId: { type: DataTypes.INTEGER, allowNull: false },
    weight: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
    marks: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
  }, {
    sequelize,
    modelName: 'Assessment',
  });
  return Assessment;
};