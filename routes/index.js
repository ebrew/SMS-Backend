require('dotenv').config();
var express = require('express');
var router = express.Router();
const { isAuth } = require('../utility/cleaning');
const { User, Student } = require("../db/models/index")

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'SMS APIs' });
});

// Logout API endpoint
router.get('/logout', async (req, res) => {
  try {
    // Get the JWT token from the request headers
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader) {
      return res.status(401).json({ message: 'Authorization failed. No token provided!' });
    }

    const token = authorizationHeader.split(' ')[1];

    const user = isAuth(token, 'Staff');

    if (!user) {
      // when false
      return res.status(500).json({ message: 'Authorization failed!' });
    }
   
    const tokens = user.tokens;
    const newTokens = tokens.filter(t => t.token !== token);

    // Determine which model to use based on the user's role
    const ModelToUpdate = user.role === 'Student' ? Student : User;
    await ModelToUpdate.update( { tokens: newTokens }, { where: { id: user.id } } );

    return res.status(200).json({ message: 'Successfully logged out' });
  } catch (error) {
    console.error('Error logging out:', error);
    return res.status(500).json({ message: 'Cannot logout at the moment!' });
  }
});


module.exports = router;
