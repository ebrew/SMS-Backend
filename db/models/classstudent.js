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
      this.belongsTo(models.Section, { foreignKey: 'classSectionId', onDelete: 'CASCADE', onUpdate:'CASCADE' });
      this.belongsTo(models.Student, { foreignKey: 'studentId', onDelete: 'CASCADE', onUpdate:'CASCADE' });
      this.belongsTo(models.AcademicYear, { foreignKey: 'academicYearId', onDelete: 'CASCADE', onUpdate:'CASCADE' });
    }
  }
  ClassStudent.init({
    classSessionId: { type: DataTypes.INTEGER, allowNull: false },
    studentId: { type: DataTypes.INTEGER, allowNull: false },
    academicYearId: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    sequelize,
    modelName: 'ClassStudent',
  });
  return ClassStudent;
};
