'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Attendance extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.Student, { foreignKey: 'studentId', onDelete: 'CASCADE', onUpdate:'CASCADE'  });
      this.belongsTo(models.AcademicTerm, { foreignKey: 'academicTermId', onDelete: 'CASCADE', onUpdate:'CASCADE'  });
    }
  }
  Attendance.init({
    studentId: { type: DataTypes.INTEGER, allowNull: false },
    academicTermId: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.ENUM('Present', 'Absent', 'Not Yet'), defaultValue: 'Not Yet', allowNull:true },
    date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, allowNull: false },
  }, {
    sequelize,
    modelName: 'Attendance',
  });
  return Attendance;
};