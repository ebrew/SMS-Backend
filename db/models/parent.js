'use strict';
const bcrypt = require('bcrypt');
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Parent extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Parent.init({
    fullName: { type: DataTypes.STRING, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    relationship: { type: DataTypes.STRING, allowNull: false },
    address: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true, unique: true },
    phone: { type: DataTypes.STRING, allowNull: false, unique: true },
    homePhone: { type: DataTypes.STRING, allowNull: true, unique: true },
    role: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Parent'},
    occupation: { type: DataTypes.STRING, allowNull: true },
    employer: { type: DataTypes.STRING, allowNull: true },
    employerAddress: { type: DataTypes.STRING, allowNull: true },
    workPhone: { type: DataTypes.STRING, allowNull: true },
    password: { type: DataTypes.STRING, allowNull: false },
    resetToken: { type: DataTypes.STRING, allowNull: true },
    resetTokenExpiration: DataTypes.DATE,
    isPasswordReset: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  }, {
    sequelize,
    modelName: 'Parent',
  });

  Parent.beforeCreate(async (user) => {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    user.password = hashedPassword;  
    user.email = user.email ? user.email.toLowerCase() : null;
  });
  return Parent;
};


