'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Department extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.hasMany(models.User, { as: 'users', foreignKey: 'id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
      this.hasMany(models.Student, { as: 'students', foreignKey: 'id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
      this.belongsTo(models.User, { as: 'hod', foreignKey: 'hodId', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
    }
  }
  Department.init({
    name: { type: DataTypes.STRING, allowNull: false, unique: true, collate: 'utf8_bin' },  // This sets a case-sensitive collation
    description: { type: DataTypes.TEXT, allowNull: true, unique: false },
    hodId: { type: DataTypes.INTEGER, allowNull: true }
  }, {
    sequelize,
    modelName: 'Department',
  });
  return Department;
};

