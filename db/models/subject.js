'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Subject extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.hasMany(models.AssignedSubject, { foreignKey: 'subjectId', onDelete: 'CASCADE', onUpdate: 'CASCADE' }); 
      this.hasMany(models.ClassSubject, { foreignKey: 'subjectId', onDelete: 'CASCADE', onUpdate: 'CASCADE' }); 
    }
  }
  Subject.init({
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    code: { type: DataTypes.STRING, allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true, unique: false },
  }, {
    sequelize,
    modelName: 'Subject',
  });
  return Subject;
};