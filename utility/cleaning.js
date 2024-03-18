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

// Decoding jwt token
exports.decodeToken = (token) => {
    try {
        const decodedToken = jwt.verify(token, process.env.SECRET_KEY);
        return { status: true, decodedToken };
    } catch (err) {
        return { status: false, error: err };
    }
}