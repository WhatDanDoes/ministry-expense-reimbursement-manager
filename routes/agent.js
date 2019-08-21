'use strict';

const express = require('express');
const passport = require('passport');
const router = express.Router();
const models = require('../models');
const fs = require('fs');
const jwt = require('jsonwebtoken');

/**
 * GET /agent
 */
router.get('/', function(req, res) {
  if (!req.isAuthenticated()) { 
    req.flash('error', 'You need to login first');
    return res.redirect('/');
  }
  req.user.getReadablesAndFiles(function(err, readables) {
    if (err) {
      req.flash('error', err.message);
      return res.redirect('/');
    }

    req.user.getWritablesAndFiles(function(err, writables) {
      if (err) {
        req.flash('error', err.message);
        return res.redirect('/');
      }
  
      // To open deep link with auth token
      const payload = { email: req.user.email };
      const token = jwt.sign(payload, process.env.SECRET, { expiresIn: '1h' });
  
      res.render('agent/index', { messages: req.flash(), agent: req.user, readables: readables, token: token, writables: writables});
    });
  });
});



module.exports = router;
