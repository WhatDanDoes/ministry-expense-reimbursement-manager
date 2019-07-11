const express = require('express');
const passport = require('passport');
const router = express.Router();
const models = require('../models');

router.get('/', function(req, res) {
  req.logout();
  req.session = null;
  if (req.accepts('text/html')) {
    return res.redirect('/');
  }
  return res.status(204).send();
});


module.exports = router;

