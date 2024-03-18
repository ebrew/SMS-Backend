'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Section extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.Class, { foreignKey: 'classId', onDelete: 'CASCADE', onUpdate:'CASCADE' });
    }
  }
  Section.init({
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    capacity: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    classId: { type: DataTypes.INTEGER, allowNull: false } 
  }, {
    sequelize,
    modelName: 'Section',
  });
  return Section;
};