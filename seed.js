'use strict';

const models = require('./models');
const seeder = require('mais-mongoose-seeder')(models.mongoose),
      data = require('./migrations/data.json');

models.once('open', function() {
  seeder.seed(data, {dropCollections: true}).then(function(dbData) {
    console.log('DONE: ' + JSON.stringify(dbData));
    process.exit(0);
  }).catch(function(err) {
    console.log('SEEDER ERROR: ' + err);
    process.exit(1);
  });
});



