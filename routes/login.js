'use strict';

const express = require('express');
const passport = require('passport');
const router = express.Router();
const jwt = require('jsonwebtoken');
const jwtAuth = require('../lib/jwtAuth');

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

      const payload = { email: user.email };
      const token = jwt.sign(payload, process.env.SECRET, { expiresIn: '1h' });
      return res.status(201).json({message: 'Hello, ' + req.user.email + '!', token: token });
    });
  })(req, res, next);
});

router.post('/refresh', jwtAuth,  function(req, res, next) {
  const token = jwt.sign({ email: req.user.email }, process.env.SECRET, { expiresIn: '1h' });
  return res.status(201).json({message: 'Hello, ' + req.user.email + '!', token: token });
});

module.exports = router;
