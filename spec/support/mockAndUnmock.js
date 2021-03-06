/**
 * There has got to be a better way... what am I missing?
 */
const fs = require('fs');

require('../../node_modules/negotiator/lib/mediaType');
require('../../node_modules//iconv-lite/encodings');
require('ejs');

module.exports = function(mock) {
  return function(mocks) {
    mock({
      ...mocks,
      'spec/files/troll.jpg': fs.readFileSync('spec/files/troll.jpg'),
      'spec/files/troll.png': fs.readFileSync('spec/files/troll.png'),
      'spec/files/MER-template.ods': fs.readFileSync('spec/files/MER-template.ods'),
      'views/index.ejs': fs.readFileSync('views/index.ejs'),
      'views/_partials/appLink.ejs': fs.readFileSync('views/_partials/appLink.ejs'),
      'views/_partials/head.ejs': fs.readFileSync('views/_partials/head.ejs'),
      'views/_partials/matomo.ejs': fs.readFileSync('views/_partials/matomo.ejs'),
      'views/_partials/navbar.ejs': fs.readFileSync('views/_partials/navbar.ejs'),
      'views/_partials/messages.ejs': fs.readFileSync('views/_partials/messages.ejs'),
      'views/_partials/login.ejs': fs.readFileSync('views/_partials/login.ejs'),
      'views/_partials/footer.ejs': fs.readFileSync('views/_partials/footer.ejs'),
      'views/_partials/pager.ejs': fs.readFileSync('views/_partials/pager.ejs'),
      'views/agent/index.ejs': fs.readFileSync('views/agent/index.ejs'),
      'views/image/index.ejs': fs.readFileSync('views/image/index.ejs'),
      'views/image/show.ejs': fs.readFileSync('views/image/show.ejs'),
      'views/image/_pager.ejs': fs.readFileSync('views/image/_pager.ejs'),
      'views/error.ejs': fs.readFileSync('views/error.ejs'),
      'views/reset.ejs': fs.readFileSync('views/reset.ejs'),
      'public/favicon/manifest.json': fs.readFileSync('public/favicon/manifest.json'),
      'public/images/bpe-logo.png': fs.readFileSync('public/images/bpe-logo.png'),
      'public/images/file-upload.png': fs.readFileSync('public/images/file-upload.png'),
      'public/images/merman-or-triton-3.png': fs.readFileSync('public/images/merman-or-triton-3.png'),
      'public/images/start-new.png': fs.readFileSync('public/images/start-new.png'),
      'public/js/datepicker.js': fs.readFileSync('public/js/datepicker.js'),
      'public/js/handleFileSelect.js': fs.readFileSync('public/js/handleFileSelect.js'),
      'public/js/jquery.js': fs.readFileSync('public/js/jquery.js'),
      'public/js/camera.js': fs.readFileSync('public/js/camera.js'),
      'public/stylesheets/camera.css': fs.readFileSync('public/stylesheets/camera.css'),
      'public/stylesheets/fontawesome-free-5.9.0-web/css/all.css': fs.readFileSync('public/stylesheets/fontawesome-free-5.9.0-web/css/all.css'),
      'public/stylesheets/jquery-ui-themes-1.12.1/jquery-ui.min.css': fs.readFileSync('public/stylesheets/jquery-ui-themes-1.12.1/jquery-ui.min.css'),
      'public/stylesheets/style.css': fs.readFileSync('public/stylesheets/style.css'),
    });
  };
};
