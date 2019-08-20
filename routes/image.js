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
const moment = require('moment'); 
const parseAsync = require('json2csv').parseAsync; 

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

    models.Invoice.find({ doc: { $regex: new RegExp(`${req.params.domain}/${req.params.agentId}`), $options: 'i'} }).select('doc -_id').then(invoices => {
      invoices = invoices.map(invoice => invoice.doc);


      files = files.map(file => {
        let obj = { file: `${req.params.domain}/${req.params.agentId}/${file}`, type: 'link', invoice: false };
        if ((/\.(gif|jpg|jpeg|tiff|png)$/i).test(file)) {
          obj.type = 'image';
        }

        if (invoices.includes(obj.file)) {
          obj.invoice = true;
        }

        return obj;
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
                                  canZip: files.length && invoices.length,
                                  isMobile: isMobile({ ua: req.headers['user-agent'], tablet: true})  });
    }).catch((error) => {
      req.flash('error', error.message);
      res.redirect(`/image/${req.user.getAgentDirectory()}`);
    });
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
    models.Invoice.find({ doc: { $regex: new RegExp(`${req.params.domain}/${req.params.agentId}`), $options: 'i'} }).select('doc -_id').then(invoices => {
      invoices = invoices.map(invoice => invoice.doc);


      files = files.map(file => {
        let obj = { file: `${req.params.domain}/${req.params.agentId}/${file}`, type: 'link', invoice: false };
        if ((/\.(gif|jpg|jpeg|tiff|png)$/i).test(file)) {
          obj.type = 'image';
        }

        if (invoices.includes(obj.file)) {
          obj.invoice = true;
        }

        return obj;
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
                                  canZip: files.length && invoices.length,
                                  isMobile: isMobile({ ua: req, tablet: true}) });
    }).catch((error) => {
      req.flash('error', error.message);
      res.redirect(`/image/${req.user.getAgentDirectory()}`);
    });
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

  // Read agent's upload directory
  fs.readdir(`uploads/${req.params.domain}/${req.params.agentId}`, (err, files) => {
    if (err) {
      return res.render('error', { error: err });
    }

    if (!files.length) {
      return res.status(404).json({ message: 'You have no processed invoices' });
    }

    let regexFiles = files.map(file => new RegExp(`${req.params.domain}/${req.params.agentId}/${file}`, 'i'));
    models.Invoice.find({ doc: {$in: regexFiles} }).sort([['purchaseDate', 1], ['updatedAt', -1]]).then(invoices => {
      if (!invoices.length) {
        return res.status(404).json({ message: 'You have no processed invoices' });
      }

      models.Agent.findOne({ _id: invoices[0].agent }).then(agent => {
        res.set('Content-Type', 'application/zip');
        res.attachment(`${agent.getBaseFilename()} #1-${invoices.length}.zip`);

        archive.pipe(res);

        let consolidated = [];
        invoices.forEach((invoice, index) => {
          let filename = invoice.doc.split('/').pop();
          let ext = '';
          if (filename.lastIndexOf('.') >= 0) {
            ext = `.${filename.substring(filename.lastIndexOf('.') + 1).toLowerCase()}`;
          }

          archive.file(`uploads/${invoice.doc}`, { name: `${agent.getBaseFilename()} #${index + 1}${ext}` });
          consolidated.push({
            'Category': invoice.category,
            'Purchase Date': moment(invoice.purchaseDate).format('DD MMM \'YY'),
            'Item': invoice.reason,
            'Business Purpose of Expense': models.Invoice.getCategories()[invoice.category],
            'Receipt ref #': index + 1,
            'Local Amount': invoice.formatTotal(),
            'Currency Used': invoice.currency,
            'Exchange Rate': invoice.exchangeRate,
          });
        });

        parseAsync(consolidated).then(csv => {
          if (err) {
            req.flash('error', err.message);
            return res.redirect('/image');
          }

          archive.append(csv, { name: `${agent.name.split(' ').pop()} MER.csv` });

          archive.finalize();
        }).catch(err => {
          req.flash('error', err.message);
          res.redirect(`/image/${req.user.getAgentDirectory()}`);
        });
      }).catch((error) => {
        req.flash('error', error.message);
        res.redirect(`/image/${req.user.getAgentDirectory()}`);
      });
    }).catch((error) => {
      req.flash('error', error.message);
      res.redirect(`/image/${req.user.getAgentDirectory()}`);
    });
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
  models.Invoice.findOne({ doc: `${req.params.domain}/${req.params.agentId}/${req.params.imageId}` }).then((invoice) => {
    res.render('image/show', { image: file,
                               invoice: invoice,
                               messages: req.flash(),
                               agent: req.user,
                               canWrite: canWrite,
                               today: moment().format('YYYY-MM-DD'),
                               categories: models.Invoice.getCategories() });
  }).catch((error) => {
    req.flash('error', error.message);
    res.redirect(`/image/${req.user.getAgentDirectory()}`);
  });
});

/**
 * PUT /image/:domain/:agentId/:imageId
 */
router.put('/:domain/:agentId/:imageId', ensureAuthorized, (req, res) => {
  const canWrite = RegExp(req.user.getAgentDirectory()).test(req.path);

  if (!canWrite) {
    req.flash('info', 'You do not have access to that resource');
    return res.redirect(`/image/${req.params.domain}/${req.params.agentId}`);
  }

  req.body.agent = req.user._id;
  req.body.doc = `${req.params.domain}/${req.params.agentId}/${req.params.imageId}`;
  if (req.body.currency === 'CAD') {
    req.body.exchangeRate = 1.0;
  }

  models.Invoice.findOneAndUpdate({doc: req.body.doc}, req.body, { upsert: true, new: true }).then(result => {
    req.flash('success', 'Invoice saved');
    res.redirect(`/image/${req.params.domain}/${req.params.agentId}`);
  }).catch((error) => {
    req.flash('error', error.message);
    res.redirect(`/image/${req.params.domain}/${req.params.agentId}/${req.params.imageId}`);
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
 * DELETE /image/:domain/:agentId/:imageId
 */
router.delete('/:domain/:agentId/:imageId', ensureAuthorized, function(req, res) {
  const canWrite = RegExp(req.user.getAgentDirectory()).test(req.path);
  if (!canWrite){
    req.flash('error', 'You are not authorized to delete that resource');
    return res.redirect(`/image/${req.params.domain}/${req.params.agentId}`);
  }

  models.Invoice.deleteOne({ doc: `${req.params.domain}/${req.params.agentId}/${req.params.imageId}` }).then(results => {
    fs.unlink(`uploads/${req.params.domain}/${req.params.agentId}/${req.params.imageId}`, (err) => {
      if (err) {
        req.flash('info', err.message);
        return res.redirect(`/image/${req.params.domain}/${req.params.agentId}`);
      }
      req.flash('info', 'Image deleted');
      res.redirect(`/image/${req.params.domain}/${req.params.agentId}`);
    });
  }).catch(error => {
    req.flash('error', error.message);
    res.redirect(`/image/${req.params.domain}/${req.params.agentId}/${req.params.imageId}`);
  });
});

module.exports = router;
