'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class AcademicTerm extends Model {
    static associate(models) {
      this.belongsTo(models.AcademicYear, { foreignKey: 'academicYearId', onDelete: 'CASCADE', onUpdate:'CASCADE' });
      this.hasMany(models.Assessment, { foreignKey: 'academicTermId', onDelete: 'CASCADE', onUpdate:'CASCADE'  });  
      this.hasMany(models.Billing, { foreignKey: 'academicTermId', onDelete: 'CASCADE', onUpdate:'CASCADE'  });
      this.hasMany(models.Attendance, { foreignKey: 'academicTermId', onDelete: 'CASCADE', onUpdate:'CASCADE'  });
           
    }

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
  
  AcademicTerm.init({
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    status: { type: DataTypes.ENUM('Active', 'Inactive', 'Pending'), defaultValue: 'Active' },
    startDate: DataTypes.DATEONLY,
    endDate: DataTypes.DATEONLY,
    academicYearId: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    sequelize,
    modelName: 'AcademicTerm',
  });

  return AcademicTerm;
};