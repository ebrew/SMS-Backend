const { History } = require("../db/models/index");

const logUserAction = async (role, id, action, description) => {
  try {
    role === 'Student' ? 
    await History.create({ studentId: id, action, description }) :
    await History.create({ userId: id, action, description });
    
  } catch (error) {
    console.error('Error logging user action:', error);
  }
};

module.exports = logUserAction;
