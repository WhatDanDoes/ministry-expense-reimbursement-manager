const router = require('express').Router();
const fs = require('fs');

/* GET home page. */
router.get('/', function(req, res, next) {

  fs.readdir('uploads', (err, files) => {
    files = files.filter(item => (/\.(gif|jpg|jpeg|tiff|png)$/i).test(item));
    if (err) {
      return res.render('error', { error: err });
    }
    if (req.user) {
      return res.render('index', { images: files.reverse(), messages: req.flash(), agent: req.user });
    }
    res.render('index', { images: files.reverse(), messages: req.flash(), agent: null });
  });
});

module.exports = router;
