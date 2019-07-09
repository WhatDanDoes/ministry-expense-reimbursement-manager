'use strict';

const express = require('express');
const passport = require('passport');
const router = express.Router();

const redirects = {
  failureRedirect: '/',
  failureFlash: 'Email or password is wrong' 
};

router.post('/', passport.authenticate('local', redirects), function(req, res) {
  req.flash('info', 'Hello, ' + req.user.email + '!');
  res.redirect('/');
});

module.exports = router;
