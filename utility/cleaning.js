const jwt = require('jsonwebtoken');
const { User, Student } = require("../db/models/index")

// Function to normalize db phone numbers
exports.normalizeGhPhone = (phone) => {
  // Remove any non-digit characters
  const cleanedPhoneNumber = phone.replace(/\D/g, '');

  // Get the last 9 characters
  return `+233${cleanedPhoneNumber.slice(-9)}`;
}

// function to extract details from json Object
exports.extractJsonFromToken = (token) => {
  try {
    const tokenObject = JSON.parse(token);
    const id = tokenObject.id;
    const role = tokenObject.role;
    return { id, role };
  } catch (error) {
    return false;
  }
}

exports.extractIdAndRoleFromToken = (token) => {
  // Check if the token contains 'id:' and 'role:' strings
  if (token.includes('id:') && token.includes('role:')) {
    // Split the token string by ','
    const parts = token.split(',');

    // Iterate over the parts to find 'id:' and 'role:' strings
    parts.forEach(part => {
      if (part.trim().startsWith('id:')) {
        // Extract the id value
        id = parseInt(part.trim().substring(3)); // Remove 'id:' and parse as integer
      } else if (part.trim().startsWith('role:')) {
        // Extract the role value
        role = part.trim().substring(5); // Remove 'role:'
        // Remove quotes if present
        if (role.startsWith("'") || role.startsWith('"')) {
          role = role.substring(1, role.length - 1);
        }
      }
    });

    return { id, role };
    
  } else {
    return false
  }
}

// Decode token
exports.isAuth = async (token, role) => {
  try {
    const decode = jwt.verify(token, process.env.SECRET_KEY);
    const user = role === 'Staff' ? await User.findById(decode.id) : await Student.findById(decode.id);
    
    if (!user)
      return false;

    //  // Populate the tokens property if it exists in the user object
    // if (!user.tokens) {
    //   user.tokens = []; // Initialize tokens array if it doesn't exist
    // } 
      
    return user;
  } catch (err) {
    return false;
  }
}
