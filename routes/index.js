const router = require('express').Router();
const fs = require('fs');

/* GET home page. */
router.get('/', function(req, res, next) {
  fs.readdir('public/images/uploads', (err, files) => {
    files = files.filter(item => (/\.(gif|jpg|jpeg|tiff|png)$/i).test(item));
    if (err) {
      return res.render('error', { error: err });
    }
    res.render('index', { images: files.reverse() });
  });
});

module.exports = router;
