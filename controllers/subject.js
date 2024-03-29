require('dotenv').config();
const { Op, or, and } = require('sequelize');
const passport = require('../db/config/passport')
const { Subject } = require("../db/models/index");

// Get all departments
exports.allSubjects = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const subjects = await Subject.findAll({ order: [['name', 'ASC']] })
      return res.status(200).json({ 'subjects': subjects });
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ Error: "Can't fetch data at the moment!" });
    }
  });
};

// Create a new department
exports.addSubject = async (req, res) => {
  passport.authenticate("jwt", { session: false })(req, res, async (err) => {
    if (err)
      return res.status(401).json({ message: 'Unauthorized' });

    try {
      const { name, code, description } = req.body;
      console.log('PLS check here: ', req.body)

      if (!name || !code)
        return res.status(400).json({ message: 'Incomplete fields!' });

      const alreadyExist = await Subject.findOne({
        where: {
          [Op.or]: [
            { name: {[Op.iLike]: name} },
            { code: {[Op.iLike]: code} }
          ],
        },
      })

      if (alreadyExist)
        return res.status(400).json({ message: 'Subject already exist!' });

      const savedSubject = await new Subject({ name, code, description }).save()

      if (savedSubject) res.status(200).json({ message: 'Saved successfully!', 'Subject': savedSubject });
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ Error: 'Cannot create subject at the moment!' });
    }
  })
};




