var express = require('express');
var router = express.Router();

router.post('/', function(req, res, next) {
  console.log('POSTING');

  res.status(201).json({ message: 'Image received' });
});

module.exports = router;
