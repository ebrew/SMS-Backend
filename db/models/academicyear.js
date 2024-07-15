'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AcademicYear extends Model {
    static associate(models) {
      this.hasMany(models.AcademicTerm, { foreignKey: 'academicYearId', onDelete: 'CASCADE', onUpdate: 'CASCADE' }); 
      this.hasMany(models.ClassStudent, { foreignKey: 'academicYearId', onDelete: 'CASCADE', onUpdate: 'CASCADE' }); 
    }

    // async setInactiveIfEndDateDue() {
    //   if (this.status === 'Active' && new Date() >= this.endDate) {
    //     this.status = 'Inactive';
    //     await this.save();
    //   }
    // }
    
    // Method to update status based on the current date
    async setInactiveIfEndDateDue() {
      const now = new Date();
      if (this.status === 'Active' && now > new Date(this.endDate)) {
        this.status = 'Inactive';
        await this.save();
      } else if (this.status === 'Pending' && now >= new Date(this.startDate)) {
        this.status = 'Active';
        await this.save();
      }
    }
    
  }

  AcademicYear.init({
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    status: { type: DataTypes.ENUM('Active', 'Inactive', 'Pending'), defaultValue: 'Active' },
    startDate: DataTypes.DATEONLY,
    endDate: DataTypes.DATEONLY
  }, {
    sequelize,
    modelName: 'AcademicYear'
  });

  return AcademicYear;
};
