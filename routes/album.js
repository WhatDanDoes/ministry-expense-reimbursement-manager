const router = require('express').Router();
const fs = require('fs');
const models = require('../models'); 

/* GET /album */
router.get('/', function(req, res, next) {
  if (!req.user) {
    return redirect('/login');
  }
  res.render('album/index', { title: process.env.TITLE, agent: req.user, messages: req.flash() }); 
}); 

/**
 * GET /album/:id
 */
router.get('/:id', function(req, res) {
  if (!req.isAuthenticated()) { return res.sendStatus(401); }

  models.Album.findById(req.params.id).populate('images reviewers viewers submitters').then(function(album) {
    res.render('album/index', { album: album, agent: req.user, messages: req.flash() });
  }).catch(function(error) {
    return res.sendStatus(501);
  });
});

/**
 * POST /album
 */
router.post('/', function(req, res) {
  if (!req.isAuthenticated()) { return res.sendStatus(401); }

  let album = new models.Album({ name: req.body.name });
  album.reviewers.push(req.user._id);
  album.viewers.push(req.user._id);
  album.submitters.push(req.user._id);

  album.save().then(function(results) {
    req.user.reviewables.push(album._id); 
    req.user.submittables.push(album._id); 
    req.user.viewables.push(album._id); 
    models.Agent.findByIdAndUpdate(req.user._id, req.user).then(function(results) {
      req.flash('success', album.name + ' is open');
      res.redirect('/album/' + album._id);
    }).catch(function(err) {
      req.flash('error', err.errors.name.message);
      res.render('album/index', { agent: req.user, messages: req.flash() });
    });
  }).catch(function(err) {
    req.flash('error', err.errors.name.message);
    res.render('album/index', { agent: req.user, messages: req.flash() });
  });
});

module.exports = router;
