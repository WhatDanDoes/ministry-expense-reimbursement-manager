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
const child_process = require('child_process'); 
const stream = require('stream');

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
    if (files.indexOf('archive') > -1) {
      files.splice(files.indexOf('archive'), 1)
    }
    if (files.indexOf('templates') > -1) {
      files.splice(files.indexOf('templates'), 1)
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

      res.render('image/index', { images: files,
                                  messages: req.flash(),
                                  agent: req.user,
                                  nextPage: nextPage,
                                  prevPage: 0,
                                  token: token,
                                  canArchive: !!files.length,
                                  canZip: !!files.length && !!invoices.length,
                                  path: req.path,
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

      res.render('image/index', { images: files,
                                  messages: req.flash(),
                                  agent: req.user,
                                  nextPage: nextPage,
                                  prevPage: prevPage,
                                  token: token,
                                  canArchive: !!files.length,
                                  path: req.path,
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
router.get('/:domain/:agentId/zip', ensureAuthorized, (req, res, next) => {
  if (!req.user.isWriter) {
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
    return res.redirect('/image');
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
      req.flash('error', 'You have no processed invoices');
      return res.redirect(`/image/${req.params.domain}/${req.params.agentId}`);
      //return res.status(404).json({ message: 'You have no processed invoices' });
    }

    if (files.indexOf('archive') > -1) {
      files.splice(files.indexOf('archive'), 1)
    }

    if (files.indexOf('templates') > -1) {
      files.splice(files.indexOf('templates'), 1)
    }


    let regexFiles = files.map(file => new RegExp(`${req.params.domain}/${req.params.agentId}/${file}`, 'i'));
    models.Invoice.find({ doc: {$in: regexFiles} }).sort([['purchaseDate', 1], ['updatedAt', -1]]).then(invoices => {
      if (!invoices.length) {
        req.flash('error', 'You have no processed invoices');
        return res.redirect(`/image/${req.params.domain}/${req.params.agentId}`);
        //return res.status(404).json({ message: 'You have no processed invoices' });
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

          // Split `reason` field into `Item` and `Business Purpose of Expense`
          let item = invoice.reason;
          let purpose = models.Invoice.getCategories()[invoice.category];
          let forMatch = / for /.exec(item);
          let toMatch = / to /.exec(item);

          let parts;
          if (forMatch && toMatch) {
            if (forMatch.index > toMatch.index) {
              parts = item.split('to');
              item = parts.shift().trim(); 
              purpose = parts.join('to').trim();
            }
            else {
              parts = item.split('for');
              item = parts.shift().trim(); 
              purpose = parts.join('for').trim();
            }
            purpose = purpose.charAt(0).toUpperCase() + purpose.slice(1);
          }
          else if (forMatch) {
            parts = item.split('for');
            item = parts.shift().trim();
            purpose = parts.join('for').trim();
            purpose = purpose.charAt(0).toUpperCase() + purpose.slice(1);
          }
          else if (toMatch) {
            parts = item.split('to');
            item = parts.shift().trim();
            purpose = parts.join('to').trim();
            purpose = purpose.charAt(0).toUpperCase() + purpose.slice(1);
          }

          archive.file(`uploads/${invoice.doc}`, { name: `${agent.getBaseFilename()} #${index + 1}${ext}` });
          consolidated.push({
            'Category': invoice.category,
            'Purchase Date': moment(invoice.purchaseDate).format('DD MMM \'YY'),
            'Item': item,
            'Business Purpose of Expense': purpose,
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

          /**
           * ODS template
           */
          let templatePath = `uploads/${agent.getAgentDirectory()}/templates/MER-template.ods`;
          fs.access(templatePath, fs.constants.R_OK, err => {
            if (err) {
              templatePath = 'public/templates/MER-template.ods';
            }

            const csvStream = new stream.Readable({read(size) {
              this.push(csv);
              this.push(null);
            }});

            const args = [
              '-t', '2', // populate tab 2 of spreadsheet
              '-s', '2', // skip header of CSV
              '-o', '1,2,3,,4,5,6,7,8', // match CSV columns to spreadsheet columns
              '--template=' + templatePath,
            ];
            const proc = child_process.spawn('csv2odf', args, { stdio: 'pipe' });
            csvStream.pipe(proc.stdin);

            proc.stderr.on('data', data => {
              console.log(`csv2odf: ${data}`);
            });

            proc.on('close', code => {
              console.log(`csv2odf process close all stdio with code ${code}`);
            });

            proc.on('exit', code => {
              if (code) {
                archive.abort()
                req.flash('error', 'Could not create spreadsheet');
                return next('Could not create spreadsheet');
              } else {
                archive.finalize();
              }
            });

            archive.append(proc.stdout, { name: `${agent.name.split(' ').pop()} MER.ods` });
          });
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
  let file = {file: req.path};
  if ((/\.(gif|jpg|jpeg|tiff|png)$/i).test(req.path)) {
    file.type = 'image';
  }
  models.Invoice.findOne({ doc: `${req.params.domain}/${req.params.agentId}/${req.params.imageId}` }).then((invoice) => {
    res.render('image/show', { image: file,
                               invoice: invoice,
                               messages: req.flash(),
                               agent: req.user,
                               path: `${req.params.domain}/${req.params.agentId}`,
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
  if (!req.user.isWriter) {
    req.flash('info', 'You do not have access to that resource');
    return res.redirect(`/image/${req.params.domain}/${req.params.agentId}`);
  }

  models.Agent.findOne({ email: `${req.params.agentId}@${req.params.domain}` }).then(owner => {
    if (!owner) {
      return res.status(400).json({ message: 'No such account' });
    }
    req.body.agent = owner._id;
    req.body.doc = `${req.params.domain}/${req.params.agentId}/${req.params.imageId}`;
    if (req.body.currency === 'CAD') {
      req.body.exchangeRate = 1.0;
    }
    req.body.currency = req.body.currency.toUpperCase();

    models.Invoice.findOneAndUpdate({doc: req.body.doc}, req.body, { upsert: true, new: true, runValidators: true }).then(result => {
      req.flash('success', 'Invoice saved');
      res.redirect(`/image/${req.params.domain}/${req.params.agentId}`);
    }).catch((error) => {
      let msg = '';
      for (let err in error.errors) {
        msg += error.errors[err].message + '. ';
      }
      req.flash('error', msg);

      let file = {file: req.path};
      if ((/\.(gif|jpg|jpeg|tiff|png)$/i).test(req.path)) {
        file.type = 'image';
      }

      //res.redirect(`/image/${req.params.domain}/${req.params.agentId}/${req.params.imageId}`);
      res.render('image/show', { image: file,
                                 invoice: new models.Invoice(req.body),
                                 messages: req.flash(),
                                 agent: req.user,
                                 path: `${req.params.domain}/${req.params.agentId}/${req.params.imageId}`,
                                 today: moment().format('YYYY-MM-DD'),
                                 categories: models.Invoice.getCategories() });
     });
  }).catch(error => {
    req.flash('error', error.message);
    res.redirect(`/image/${req.params.domain}/${req.params.agentId}/${req.params.imageId}`);
  });
});

/**
 * saveUploads
 *
 * Used for POSTing images
 */
function saveUploads(req, res, done) {
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

    let agentDirectory;
    if (Object.keys(req.params).length) {
      agentDirectory = `${req.params.domain}/${req.params.agentId}` ;
    }
    else {
      let parts = req.user.email.split('@');
      agentDirectory = `${parts[1]}/${parts[0]}` ;
    }
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
      return done(err);
    }
    done()
  });
}

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

  saveUploads(req, res, (err, message) => {
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
    return res.redirect(`/image`);
  });
});

/**
 * POST /image/:domain/:agentId
 */
router.post('/:domain/:agentId', upload.array('docs'), ensureAuthorized, (req, res) => {
  if (!req.user.isWriter) {
    if (/json/.test(req.headers['accept'])) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    req.flash('error', 'You are not authorized to post to that account');
    return res.redirect(`/image/${req.params.domain}/${req.params.agentId}`);
  }

  saveUploads(req, res, (err) => {
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
    return res.redirect(`/image/${req.params.domain}/${req.params.agentId}`);
  });
});

/**
 * DELETE /image/:domain/:agentId/:imageId
 */
router.delete('/:domain/:agentId/:imageId', ensureAuthorized, function(req, res) {
  if (!req.user.isWriter){
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

/**
 * POST /image/:domain/:agentId/archive
 */
router.post('/:domain/:agentId/archive', ensureAuthorized, (req, res) => {
  if (!req.user.isWriter){
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Read agent's upload directory
  fs.readdir(`uploads/${req.params.domain}/${req.params.agentId}`, (err, files) => {
    if (err) {
      return res.render('error', { error: err });
    }

    if (files.indexOf('archive') > -1) {
      files.splice(files.indexOf('archive'), 1)
    }

    if (files.indexOf('templates') > -1) {
      files.splice(files.indexOf('templates'), 1)
    }

    if (!files.length) {
      return res.status(404).json({ message: 'You have no invoices to archive' });
    }

    function recursiveSave(done) {
      if (!files.length) {
        return done();
      }
      let file = files.pop();
      models.Invoice.findOneAndUpdate({ doc: `${req.params.domain}/${req.params.agentId}/${file}` }, { doc: `${req.params.domain}/${req.params.agentId}/archive/${file}` }).then(invoice => {
        mv(`uploads/${req.params.domain}/${req.params.agentId}/${file}`, `uploads/${req.params.domain}/${req.params.agentId}/archive/${file}`, { mkdirp: true }, function(err) {
          if (err) {
            return done(err);
          }
          recursiveSave(done);
        });
      }).catch(err => {
        done(err);
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
        return res.status(201).json({ message: 'You can now start a new expense claim' });
      }
      req.flash('success', 'You can now start a new expense claim');
      return res.redirect(`/image/${req.params.domain}/${req.params.agentId}`);
    });
  });
});

module.exports = router;
