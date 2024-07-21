'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ClassStudent extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.Section, { foreignKey: 'classSessionId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
      this.belongsTo(models.Student, { foreignKey: 'studentId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
      this.belongsTo(models.AcademicYear, { foreignKey: 'academicYearId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
      this.belongsTo(models.Section, { foreignKey: 'promotedTo', as: 'PromotedTo', onDelete: 'SET NULL', onUpdate: 'CASCADE' }); 
    }
  }
  ClassStudent.init({
    classSessionId: { type: DataTypes.INTEGER, allowNull: false },
    studentId: { type: DataTypes.INTEGER, allowNull: false },
    academicYearId: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.ENUM('Promoted', 'Repeated', 'Graduated', 'Not Yet'), defaultValue: 'Not Yet', allowNull: false },
    promotedTo: { type: DataTypes.INTEGER, allowNull: true }
  }, {
    sequelize,
    modelName: 'ClassStudent',
  });
  return ClassStudent;
};