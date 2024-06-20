'use strict';
const bcrypt = require('bcrypt');
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.Department, { foreignKey: 'departmentId', onDelete: 'SET NULL', onUpdate:'CASCADE' });
      this.hasMany(models.AssignedTeacher, { foreignKey: 'teacherId', onDelete: 'CASCADE', onUpdate: 'CASCADE' }); 
      this.hasMany(models.ResetRequest, { foreignKey: 'userId', onDelete: 'CASCADE', onUpdate: 'CASCADE' }); 
      this.hasMany(models.Assessment, { foreignKey: 'teacherId', onDelete: 'CASCADE', onUpdate:'CASCADE' });
    }
  }
  User.init({
    userName: { type: DataTypes.STRING, allowNull: false, unique: true },
    firstName: { type: DataTypes.STRING, allowNull: false },
    lastName: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true, unique: true },
    phone: { type: DataTypes.STRING, allowNull: true, unique: true },
    address: { type: DataTypes.STRING, allowNull: true },
    role: { type: DataTypes.STRING, allowNull: false },
    staffID: { type: DataTypes.STRING, allowNull: true },
    dob: { type: DataTypes.DATE, allowNull: true },
    gender: { type: DataTypes.ENUM('Male', 'Female'), allowNull: false },
    password: { type: DataTypes.STRING, allowNull: false },
    resetToken: DataTypes.STRING,
    resetTokenExpiration: DataTypes.DATE,
    isPasswordReset: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    dp: { type: DataTypes.STRING, allowNull: true },
    departmentId: { type: DataTypes.INTEGER, allowNull: true },
    // tokens: [{ type: Object}]
  }, {
    sequelize,
    modelName: 'User',
  });

  User.beforeCreate(async (user) => {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    user.password = hashedPassword;  
    user.email = user.email ? user.email.toLowerCase() : null;
  });

  return User;
};




// assessmentId: {
//   type: Sequelize.INTEGER,
//   allowNull: false,
//   references: {
//     model: 'Assessments',
//     key: 'id'
//   },
//   onDelete: 'CASCADE',
//   onUpdate: 'CASCADE'
// },