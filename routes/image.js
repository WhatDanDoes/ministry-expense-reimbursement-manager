'use strict';

const express = require('express');
const router = express.Router();
const multer  = require('multer');
const models = require('../models');
const timestamp = require('time-stamp');
const mv = require('mv');
const jwt = require('jsonwebtoken');
const jwtAuth = require('../lib/jwtAuth');
const ensureAuthorized = require('../lib/ensureAuthorized');
const fs = require('fs');
const mkdirp = require('mkdirp');
const isMobile = require('is-mobile');
const archiver = require('archiver');

// Set upload destination directory
let storage = multer.diskStorage({
  destination: '/tmp',
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
let upload = multer({ storage: storage });

/**
 * GET /image
 */
router.get('/', (req, res) => {
  if (!req.isAuthenticated()) {
    req.flash('error', 'You need to login first');
    return res.redirect('/');
  }

  res.redirect(`/image/${req.user.getAgentDirectory()}`);
});

/**
 * GET /image/:domain/:agentId
 */
const MAX_IMGS = 30;
router.get('/:domain/:agentId', ensureAuthorized, (req, res) => {
  if (!fs.existsSync(`uploads/${req.params.domain}/${req.params.agentId}`)){
    mkdirp.sync(`uploads/${req.params.domain}/${req.params.agentId}`);
  }

  fs.readdir(`uploads/${req.params.domain}/${req.params.agentId}`, (err, files) => {
    if (err) {
      return res.render('error', { error: err });
    }

    //files = files.filter(item => (/\.(gif|jpg|jpeg|tiff|png)$/i).test(item));
    //files = files.map(file => `${req.params.domain}/${req.params.agentId}/${file}`).reverse();
    files = files.map(file => {
      if ((/\.(gif|jpg|jpeg|tiff|png)$/i).test(file)) {
        return { file: `${req.params.domain}/${req.params.agentId}/${file}`, type: 'image' };
      }
      return { file: `${req.params.domain}/${req.params.agentId}/${file}`, type: 'link' };
    });
    files.reverse();


    let nextPage = 0;
    if (files.length > MAX_IMGS) {
      nextPage = 2;
      files = files.slice(0, MAX_IMGS);
    }

    // To open deep link with auth token
    const payload = { email: req.user.email };
    const token = jwt.sign(payload, process.env.SECRET, { expiresIn: '1h' });

    const canWrite = RegExp(req.user.getAgentDirectory()).test(req.path);
    res.render('image/index', { images: files,
                                messages: req.flash(),
                                agent: req.user,
                                nextPage: nextPage,
                                prevPage: 0,
                                token: token,
                                canWrite: canWrite,
                                isMobile: isMobile({ ua: req.headers['user-agent'], tablet: true})  });
  });
});

/**
 * GET /image/:domain/:agentId/page/:num
 */
router.get('/:domain/:agentId/page/:num', ensureAuthorized, (req, res, next) => {
  fs.readdir(`uploads/${req.params.domain}/${req.params.agentId}`, (err, files) => {
    if (err) {
      return res.render('error', { error: err });
    }

//    files = files.filter(item => (/\.(gif|jpg|jpeg|tiff|png)$/i).test(item));
//    files = files.map(file => `${req.params.domain}/${req.params.agentId}/${file}`).reverse();
    files = files.map(file => {
      if ((/\.(gif|jpg|jpeg|tiff|png)$/i).test(file)) {
        return { file: `${req.params.domain}/${req.params.agentId}/${file}`, type: 'image' };
      }
      return { file: `${req.params.domain}/${req.params.agentId}/${file}`, type: 'link' };
    });
    files.reverse();

    let page = parseInt(req.params.num),
        nextPage = 0,
        prevPage = page - 1;
    if (files.length > MAX_IMGS * page) {
      nextPage = page + 1;
      files = files.slice(MAX_IMGS * prevPage, MAX_IMGS * page);
    }

    if (!nextPage && prevPage) {
      files = files.slice(MAX_IMGS * prevPage);
    }

    // To open deep link with auth token
    const payload = { email: req.user.email };
    const token = jwt.sign(payload, process.env.SECRET, { expiresIn: '1h' });

    const canWrite = RegExp(req.user.getAgentDirectory()).test(req.path);
    res.render('image/index', { images: files,
                                messages: req.flash(),
                                agent: req.user,
                                nextPage: nextPage,
                                prevPage: prevPage,
                                token: token,
                                canWrite: canWrite,
                                isMobile: isMobile({ ua: req, tablet: true}) });
  });
});

/**
 * GET /image/:domain/:agentId/zip
 */
router.get('/:domain/:agentId/zip', ensureAuthorized, (req, res) => {
  const canWrite = RegExp(req.user.getAgentDirectory()).test(req.path);

  if (!canWrite) {
    return res.sendStatus(403);
  }

  /**
   * 2019-7-25 https://github.com/archiverjs/node-archiver/blob/master/examples/express.js#L23
   * Compress uploaded files
   */
  const archive = archiver('zip');

  // Catch warnings (e.g. stat failures and other non-blocking errors)
  // Not sure what to do with all this...
  archive.on('warning', function(err) {
    if (err.code === 'ENOENT') {
      console.log('FILE NOT FOUND');
      console.log(err);
    } else {
      console.log('SOME NON-BLOCKING ERROR');
      console.log(err);
    }
  });

  // Catch this error explicitly
  archive.on('error', function(err) {
    req.flash('error', err.message);
    return redirect('/image');
  });

  // Request ends on stream close
  archive.on('end', function() {
    console.log('Archive wrote %d bytes', archive.pointer());
  });

  fs.readdir(`uploads/${req.params.domain}/${req.params.agentId}`, (err, files) => {
    if (err) {
      return res.render('error', { error: err });
    }

    res.set('Content-Type', 'application/zip');
    res.attachment(`${req.user.getBaseFilename()} #1-${files.length}.zip`);

    archive.pipe(res);

    files.forEach((file, index) => {
      let ext = '';
      if (file.lastIndexOf('.') >= 0) {
        ext = `.${file.substring(file.lastIndexOf('.') + 1).toLowerCase()}`;
      }
      
      archive.file(`uploads/${req.params.domain}/${req.params.agentId}/${file}`, { name: `${req.user.getBaseFilename()} #${index + 1}${ext}` });
    });

    archive.finalize();
  });
});


/**
 * GET /image/:domain/:agentId/:imageId
 */
router.get('/:domain/:agentId/:imageId', ensureAuthorized, (req, res) => {
  const canWrite = RegExp(req.user.getAgentDirectory()).test(req.path);
  let file = {file: req.path};
  if ((/\.(gif|jpg|jpeg|tiff|png)$/i).test(req.path)) {
    file.type = 'image';
  }
  res.render('image/show', { image: file,
                             messages: req.flash(),
                             agent: req.user,
                             canWrite: canWrite,
                             categories: models.Invoice.getCategories() });
});

/**
 * POST /image/:domain/:agentId/:imageId
 */
router.post('/:domain/:agentId/:imageId', ensureAuthorized, (req, res) => {
  const canWrite = RegExp(req.user.getAgentDirectory()).test(req.path);

  if (!canWrite) {
    req.flash('info', 'You do not have access to that resource');
    return res.redirect(`/image/${req.params.domain}/${req.params.agentId}`);
  }

  fs.rename(`uploads/${req.params.domain}/${req.params.agentId}/${req.params.imageId}`, `public/images/uploads/${req.params.imageId}`, err => {
    if (err) {
      req.flash('info', err.message);
      return res.redirect(`/image/${req.params.domain}/${req.params.agentId}/${req.params.imageId}`);
    }

    req.flash('success', 'Image published');
    res.redirect('/');
  });
});


/**
 * POST /image
 */
//upload.array('docs', 8) limits number of files
router.post('/', upload.array('docs'), (req, res, next) => {
  if (/json/.test(req.headers['accept'])) {
    return jwtAuth(req, res, next);
  }
  if (!req.isAuthenticated()) { 
    req.flash('error', 'You need to login first');
    return res.redirect('/');
  }
  next();

}, (req, res) => {
  if (!req.isAuthenticated()) {
    if (/json/.test(req.headers['accept'])) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    req.flash('error', 'You have to login first');
    return res.redirect('/');
  }

  // No image provided
  if (!req.files || !req.files.length) {
    if (/json/.test(req.headers['accept'])) {
      return res.status(400).json({ message: 'No image provided' });
    }
    req.flash('error', 'No image provided');
    return res.redirect(`/image/${req.user.getAgentDirectory()}`);
  }

  let savePaths = [];
  let index = 0;
  for (let file of req.files) {
    let newFileName = `${timestamp('YYYY-MM-DD-HHmmssms')}`;
    if (req.files.length > 1) {
      newFileName = `${newFileName}-${index++}`;
    }
    newFileName = `${newFileName}.${file.path.split('.').pop()}`;

    let parts = req.user.email.split('@');
    const agentDirectory = `${parts[1]}/${parts[0]}` ;
    savePaths.push({
      curr: file.path,
      dest: `uploads/${agentDirectory}/${newFileName}`
    });
  }

  function recursiveSave(done) {
    if (!savePaths.length) {
      return done();
    }
    let path = savePaths.pop();
    mv(path.curr, path.dest, { mkdirp: true }, function(err) {
      if (err) {
        return done(err);
      }
      recursiveSave(done);
    });   
  };

  recursiveSave((err) => {
    if (err) {
      if (/json/.test(req.headers['accept'])) {
        return res.status(500).json({ message: err.message });
      }
      req.flash('error', err.message);
      return res.redirect(`/image/${req.user.getAgentDirectory()}`);
    }
    if (/json/.test(req.headers['accept'])) {
      return res.status(201).json({ message: 'Image received' });
    }
    req.flash('success', 'Received');
    return res.redirect(`/image/${req.user.getAgentDirectory()}`);
  });
});

/**
 * PUT /image
 */
//router.put('/:id', (req, res) => {
//  if (!req.isAuthenticated()) { return res.sendStatus(401); }
//
//  // Can only edit if a reviewer or submitter (except approval)
//  models.Agent.findById(req.user._id).then((agent) => {
//    models.Image.findById(req.params.id).populate('files album').then((image) => {
//      // Approved images cannot be changed unless dis-approved by a reviewer
//      let disapproved = false;
//      let approvalChange = req.body.approved !== undefined;
//      let notReviewer = agent.reviewables.indexOf(image.album._id.toString()) == -1;
//      if (image.approved) {
//        if (notReviewer) return res.sendStatus(403);
//        if (!approvalChange) disapproved = true;
//        else {
//          req.flash('error', 'Cannot update an approved image');
//          return res.render('image/show', { image: image, agent: agent, messages: req.flash() });
//        }
//      }
//
//      let notSubmitter = image.agent.toString() != agent._id.toString();
//      if (notSubmitter && notReviewer) return res.sendStatus(403);
//      if (notReviewer && approvalChange) return res.sendStatus(403);
// 
//      image = Object.assign(image, req.body);
//      if (!req.body.approved) image.approved = false;
//      let sum = image.tookPlaceAt.getTimezoneOffset() * 60000 + Date.parse(image.tookPlaceAt); // [min*60000 = ms] 
//      models.Image.findOneAndUpdate({ _id: req.params.id }, image, { new: true, runValidators: true }).then((image) => {
//        if (disapproved) {
//          req.flash('info', 'Image de-approved. It can now be edited.');
//          res.redirect('/image/' + image._id);
//        }
//        else {
//          req.flash('info', 'Image successfully updated');
//          res.redirect('/album/' + image.album);
//        }
//      }).catch((error) => {
//        return res.render('image/show', { image: image, agent: agent, messages: error });
//      });
//    }).catch((error) => {
//      return res.sendStatus(501);
//    });
//  }).catch((error) => {
//    return res.sendStatus(501);
//  });
//});
//
/**
 * DELETE /image/:domain/:agentId/:imageId
 */
router.delete('/:domain/:agentId/:imageId', ensureAuthorized, function(req, res) {
  const canWrite = RegExp(req.user.getAgentDirectory()).test(req.path);
  if(!canWrite){
    req.flash('error', 'You are not authorized to delete that resource');
    return res.redirect(`/image/${req.params.domain}/${req.params.agentId}`);
  }

  fs.unlink(`uploads/${req.params.domain}/${req.params.agentId}/${req.params.imageId}`, (err) => {
    if (err) {
      req.flash('info', err.message);
      return res.redirect(`/image/${req.params.domain}/${req.params.agentId}`);
    }
    req.flash('info', 'Image deleted');
    res.redirect(`/image/${req.params.domain}/${req.params.agentId}`);
  });
});

module.exports = router;
