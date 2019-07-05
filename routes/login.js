'use strict';

const express = require('express');
const passport = require('passport');
const router = express.Router();

router.post('/', passport.authenticate('local'), function(req, res) {
  req.flash('info', 'Hello, ' + req.user.email + '!');
  res.redirect('/album');
});

module.exports = router;
