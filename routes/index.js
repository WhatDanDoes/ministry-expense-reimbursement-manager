const router = require('express').Router();
const fs = require('fs');
const filterFiles = require('../lib/filterFiles');

/* GET home page. */
const MAX_IMGS = 30;

router.get('/', function(req, res, next) {
  res.render('index', { messages: req.flash(), agent: req.user });
});

router.get('/page/:num', function(req, res, next) {
  fs.readdir('public/images/uploads', (err, files) => {
    if (err) {
      return res.render('error', { error: err });
    }

    files = filterFiles(files);

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

    res.render('index', { images: files, messages: req.flash(), agent: req.user, nextPage: nextPage, prevPage: prevPage });
  });
});

module.exports = router;
