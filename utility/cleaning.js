const jwt = require('jsonwebtoken');

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


// Decoding jwt token
exports.decodeToken = (token) => {
  try {
    const decodedToken = jwt.verify(token, process.env.SECRET_KEY);
    return { status: true, decodedToken };
  } catch (err) {
    return { status: false, error: err };
  }
}