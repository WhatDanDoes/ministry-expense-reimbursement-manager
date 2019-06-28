const router = require('express').Router();
const fs = require('fs');

/* GET home page. */
router.get('/', function(req, res, next) {
  fs.readdir('public/images/uploads', (err, files) => {
    if (err) {
      return res.render('error', { error: err });
    }
    res.render('index', { images: files });
  });
});

module.exports = router;
