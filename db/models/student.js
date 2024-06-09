'use strict';
const bcrypt = require('bcrypt');
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Student extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.Parent, { foreignKey: 'parentId', onDelete: 'RESTRICT', onUpdate:'CASCADE' });
    }
  }
  Student.init({
    firstName: { type: DataTypes.STRING, allowNull: false },
    middleName: { type: DataTypes.STRING, allowNull: true },
    lastName: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true, unique: true },
    phone: { type: DataTypes.STRING, allowNull: true, unique: true },
    address: { type: DataTypes.STRING, allowNull: true },
    role: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Student'},
    studentID: { type: DataTypes.STRING, allowNull: true },
    dob: { type: DataTypes.DATE, allowNull: true },
    gender: { type: DataTypes.ENUM('Male', 'Female'), allowNull: false },
    nationality: { type: DataTypes.STRING, allowNull: false },
    passportPhoto: { type: DataTypes.STRING, allowNull: true },
    parentId: { type: DataTypes.INTEGER, allowNull: false },
    emergencyName: { type: DataTypes.STRING, allowNull: true },
    emergencyTitle: { type: DataTypes.STRING, allowNull: true },
    emergencyAddress: { type: DataTypes.STRING, allowNull: true },
    emergencyPhone: { type: DataTypes.STRING, allowNull: true },
    password: { type: DataTypes.STRING, allowNull: false },
    resetToken: DataTypes.STRING,
    resetTokenExpiration: DataTypes.DATE,
    isPasswordReset: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    departmentId: { type: DataTypes.INTEGER, allowNull: true }
  }, {
    sequelize,
    modelName: 'Student',
  });

  Student.beforeCreate(async (user) => {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    user.password = hashedPassword;  
    user.email = user.email ? user.email.toLowerCase() : null;
  });

  return Student;
};