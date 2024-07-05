'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class AcademicTerm extends Model {
    static associate(models) {
      this.belongsTo(models.AcademicYear, { foreignKey: 'academicYearId', onDelete: 'CASCADE', onUpdate:'CASCADE' });
      this.hasMany(models.Assessment, { foreignKey: 'academicTermId', onDelete: 'CASCADE', onUpdate:'CASCADE'  });      
    }

    async setInactiveIfEndDateDue() {
      if (this.status === 'Active' && new Date() > this.endDate) {
        this.status = 'Inactive';
        await this.save();
      }
    }
  }
  
  AcademicTerm.init({
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    status: { type: DataTypes.ENUM('Active', 'Inactive'), defaultValue: 'Active' },
    startDate: DataTypes.DATEONLY,
    endDate: DataTypes.DATEONLY,
    academicYearId: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    sequelize,
    modelName: 'AcademicTerm',
  });

  return AcademicTerm;
};