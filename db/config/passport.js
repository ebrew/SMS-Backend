require('dotenv').config();
const passport = require('passport');
const passportJwt = require('passport-jwt');
const ExtractJwt = passportJwt.ExtractJwt;
const StrategyJwt = passportJwt.Strategy; 
const {User} = require("../models/index")

// JWT strategy for token authentication
passport.use(
  new StrategyJwt(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.SECRET_KEY,
    }, 
    function (jwtPayload, done) {
      return User.findOne({ where: {id: jwtPayload.id}})
      // return User.findOne({ where: {email: jwtPayload.id}})
      .then((user) => {
        return done(null, user);
      }).catch((err) => {
        return done(err);
      }); 
}));


module.exports = passport;
