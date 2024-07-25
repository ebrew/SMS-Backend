const { History } = require("../db/models/index");

const logUserAction = async (user, id, action, description) => {
  try {
    user === 'Student' ? 
    await History.create({ studentId: id, action, description }) :
    await History.create({ userId: id, action, description });
    
  } catch (error) {
    console.error('Error logging user action:', error);
  }
};

module.exports = logUserAction;
