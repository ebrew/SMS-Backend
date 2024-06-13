'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Class extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'headTeacherId', onDelete: 'SET NULL', onUpdate:'CASCADE'  });
      this.hasMany(models.Section, { foreignKey: 'classId', onDelete: 'CASCADE', onUpdate: 'CASCADE' }); 
      this.hasMany(models.ClassSubject, { foreignKey: 'classId', onDelete: 'CASCADE', onUpdate: 'CASCADE' }); 
    }
  }
  Class.init({
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    grade: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    headTeacherId: { type: DataTypes.INTEGER, allowNull: true }
  }, {
    sequelize,
    modelName: 'Class',
  });
  return Class;
};