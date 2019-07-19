'use strict';

const express = require('express');
const passport = require('passport');
const router = express.Router();
const models = require('../models');
const fs = require('fs');

/**
 * GET /agent
 */
router.get('/', function(req, res) {
  if (!req.isAuthenticated()) { 
    req.flash('error', 'You need to login first');
    return res.redirect('/');
  }
  req.user.getReadables(function(err, readables) {
    res.render('agent/index', { messages: req.flash(), agent: req.user, readables: readables});
  });
});



module.exports = router;
