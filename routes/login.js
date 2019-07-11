'use strict';

const express = require('express');
const passport = require('passport');
const router = express.Router();

router.post('/', function(req, res, next) {
  passport.authenticate('local', function(err, user, info) {
    if (err) {
      return next(err);
    }
    if (!user) {
      if (req.accepts('text/html')) {
        req.flash('error', 'Invalid email or password');
        return res.redirect('/');
      }
      return res.status(401).json({message: 'Invalid email or password'});
    }
    req.logIn(user, function(err) {
      if (err) {
        return next(err);
      }
      if (req.accepts('text/html')) {
        req.flash('info', 'Hello, ' + req.user.email + '!');
        return res.redirect('/');
      }
      return res.json({message: 'Hello, ' + req.user.email + '!'});
    });
  })(req, res, next);
});

module.exports = router;
