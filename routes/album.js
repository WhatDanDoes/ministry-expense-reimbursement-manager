const router = require('express').Router();
const fs = require('fs');

/* GET / */
router.get('/', function(req, res, next) {
  if (!req.user) {
    return redirect('/login');
  }
  res.render('album/index', { title: process.env.TITLE, agent: req.user, messages: req.flash() }); 
}); 

module.exports = router;
