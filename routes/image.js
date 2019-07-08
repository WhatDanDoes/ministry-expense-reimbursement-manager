'use strict';

const express = require('express');
const passport = require('passport');
const router = express.Router();
const multer  = require('multer');
const models = require('../models');

// Set upload destination directory
let storage = multer.diskStorage({
  destination: '/tmp',
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
let upload = multer({ storage: storage });


/**
 * The show and edit routes are almost identical
 *
 * @param Object
 * @param Object
 * @param Boolean
 */
let setupImage = function(req, res, editable) {
  if (!req.isAuthenticated()) { return res.sendStatus(401); }

  // Can only view if a reviewer, submitter, or viewer
  models.Agent.findById(req.user._id).then((agent) => {
    models.Image.findById(req.params.id).populate('files album').then((image) => {
      if ((image.agent != agent._id.toString()) &&
         (agent.reviewables.indexOf(image.album._id.toString()) < 0) &&
         (agent.viewables.indexOf(image.album._id.toString()) < 0)) return res.sendStatus(403);
      res.render('image/show', { image: image, agent: agent, messages: req.flash() });
    }).catch((error) => {
      return res.sendStatus(501);
    });
  }).catch((error) => {
    return res.sendStatus(501);
  });
};

/**
 * GET /image/:id
 */
router.get('/:id', function(req, res) {
  return setupImage(req, res);
});

/**
 * POST /image
 */
router.post('/:origin?', upload.array('docs', 8), (req, res) => {
  if (!req.isAuthenticated()) { return res.sendStatus(401); }

  models.Album.findById(req.body.album).then((album) => {

    // Can only post if a member submitter
    let isSubmitter = false;
    for (let a of req.user.submittables) {
      // Double equals is significant here!
      if (a._id == req.body.album) {
        isSubmitter = true;
        break;
      }
    }
    if (!isSubmitter) {
      return res.sendStatus(403);
    }

    // Create new image
    let image = new models.Image(req.body);
    image.agent = req.user._id;
    
    // No image provided
    if (!req.files.length) {
      req.flash('error', 'No image provided');
      if (req.params.origin == 'home') {
        return res.status(400).render('album/index', { album: album, agent: req.user, messages: req.flash() });
      }
      return res.status(400).render(`album/#{album._id}`, { album: album, agent: req.user, messages: req.flash() });
    }

    image.save().then((image) => {
      // Stage attached files for database insertion
      let files = [];
      req.files.forEach((file) => {
        files.push({ path: file.path, image: image._id });
      });
    
      // Associate image with agent
      req.user.images.push(image._id);
      models.Agent.findOneAndUpdate({ '_id': req.user._id }, req.user).then((agent) => {
  
        // Associate image with album
        album.images.push(image);
        models.Album.findOneAndUpdate({ '_id': album._id }, album).then((result) => {
    
          // Save all image files
          models.ImageFile.create(files).then((results) => {
            image.files.push.apply(image.files, results);
    
            // Image has many files
            image.save().then((results) => {
              let pluralization = files.length > 1 ? 'Images' : 'Image' ;
              req.flash('success', pluralization + ' successfully submitted to ' + album.name);
              if (req.params.origin == 'home') {
                res.redirect('/album');
              }
              else {
                res.redirect('/album/' + album._id);
              }
            }).catch((err) => {
              res.status(400).send(err);
            }); // image save

          }).catch((err) => {
            res.status(400).send(err);
          }); // ImageFile create

        }).catch((err) => {
          res.status(400).send(err);
        }); // Album update
  
      }).catch((err) => {
        res.status(400).send(err);
      }); // Agent update

    }).catch((err) => {
      res.status(400).send(err);
    }); // Save image

  }).catch((err) => {
    res.status(400).send(err);
  }); // Album DB
});

/**
 * PUT /image
 */
router.put('/:id', (req, res) => {
  if (!req.isAuthenticated()) { return res.sendStatus(401); }

  // Can only edit if a reviewer or submitter (except approval)
  models.Agent.findById(req.user._id).then((agent) => {
    models.Image.findById(req.params.id).populate('files album').then((image) => {
      // Approved images cannot be changed unless dis-approved by a reviewer
      let disapproved = false;
      let approvalChange = req.body.approved !== undefined;
      let notReviewer = agent.reviewables.indexOf(image.album._id.toString()) == -1;
      if (image.approved) {
        if (notReviewer) return res.sendStatus(403);
        if (!approvalChange) disapproved = true;
        else {
          req.flash('error', 'Cannot update an approved image');
          return res.render('image/show', { image: image, agent: agent, messages: req.flash() });
        }
      }

      let notSubmitter = image.agent.toString() != agent._id.toString();
      if (notSubmitter && notReviewer) return res.sendStatus(403);
      if (notReviewer && approvalChange) return res.sendStatus(403);
 
      image = Object.assign(image, req.body);
      if (!req.body.approved) image.approved = false;
      let sum = image.tookPlaceAt.getTimezoneOffset() * 60000 + Date.parse(image.tookPlaceAt); // [min*60000 = ms] 
      models.Image.findOneAndUpdate({ _id: req.params.id }, image, { new: true, runValidators: true }).then((image) => {
        if (disapproved) {
          req.flash('info', 'Image de-approved. It can now be edited.');
          res.redirect('/image/' + image._id);
        }
        else {
          req.flash('info', 'Image successfully updated');
          res.redirect('/album/' + image.album);
        }
      }).catch((error) => {
        return res.render('image/show', { image: image, agent: agent, messages: error });
      });
    }).catch((error) => {
      return res.sendStatus(501);
    });
  }).catch((error) => {
    return res.sendStatus(501);
  });
});

/**
 * DELETE /image/:id
 */
router.delete('/:id', function(req, res) {
  if (!req.isAuthenticated()) { return res.sendStatus(401); }
  // Can only view if a reviewer or submitter
  models.Agent.findById(req.user._id).then(function(agent) {
    models.Image.findById(req.params.id).then(function(image) {
      if (image.approved) return res.sendStatus(403);
      var notSubmitter = image.agent != agent._id.toString();
      var notReviewer = agent.reviewables.indexOf(image.album.toString()) == -1;
      if (notReviewer && notSubmitter) return res.sendStatus(403);

      image.remove().then(function(results) {
        req.flash('info', 'Image deleted');
        if (notReviewer) {
          res.redirect('/');
        } else {
          res.redirect('/album/' + image.album);
        }
      }).catch(function(error) {
        return res.sendStatus(501);
      });
    }).catch(function(error) {
      return res.sendStatus(501);
    });
  }).catch(function(error) {
    return res.sendStatus(501);
  });
});

module.exports = router;
