const Browser = require('zombie');
Browser.localhost('example.com', 3001);
const fs = require('fs');

const app = require('../app');

/**
 * `mock-fs` stubs the entire file system. So if a module hasn't
 * already been `require`d the tests will fail because the 
 * module doesn't exist in the mocked file system. `ejs` and
 * `iconv-lite/encodings` are required here to solve that 
 * problem.
 */
const mock = require('mock-fs');

describe('landing page', () => {
  const browser = new Browser();

  beforeEach(done => {
    done();
  });

  afterEach(() => {
    mock.restore();
  });

  it('displays the page title set in .env', done => { 
    browser.visit('/', (err) => {
      if (err) return done.fail(err);
      browser.assert.success();
      browser.assert.text('h1', process.env.TITLE);
      done();
    });
  });

  it('displays a message if there are no images to view', done => {
    mock({ 
      'public/images/uploads': {},
      'views/index.ejs': fs.readFileSync('views/index.ejs')
    });
 
    browser.visit('/', (err) => {
      if (err) return done.fail(err);
      browser.assert.success();
      browser.assert.text('h2', 'No images');
      done();
    });
  });

  it('displays the images in the uploads directory', done => {
    mock({ 
      'public/images/uploads': {
        'image1.jpg': fs.readFileSync('spec/data/troll.jpg'),
        'image2.jpg': fs.readFileSync('spec/data/troll.jpg'),
        'image3.jpg': fs.readFileSync('spec/data/troll.jpg'),
      },
      'views/index.ejs': fs.readFileSync('views/index.ejs')
    });

    browser.visit('/', (err) => {
      mock.restore();
      if (err) return done.fail(err);
      browser.assert.success();
      browser.assert.elements('section img', 3);
      done();
    });
  });

  it('does not displays non-image files', done => {
    mock({ 
      'public/images/uploads': {
        'image1.jpg': fs.readFileSync('spec/data/troll.jpg'),
        'image2.pdf': fs.readFileSync('spec/data/troll.jpg'),
        'image3.doc': fs.readFileSync('spec/data/troll.jpg'),
      },
      'views/index.ejs': fs.readFileSync('views/index.ejs')
    });

    browser.visit('/', (err) => {
      mock.restore();
      if (err) return done.fail(err);
      browser.assert.success();
      browser.assert.elements('section img', 1);
      done();
    });
  });

  it('displays image files with wonky capitalization on the filename extension', done => {
    mock({ 
      'public/images/uploads': {
        'image1.Jpg': fs.readFileSync('spec/data/troll.jpg'),
        'image2.pdf': fs.readFileSync('spec/data/troll.jpg'),
        'image3.GIF': fs.readFileSync('spec/data/troll.jpg'),
      },
      'views/index.ejs': fs.readFileSync('views/index.ejs')
    });

    browser.visit('/', (err) => {
      mock.restore();
      if (err) return done.fail(err);
      browser.assert.success();
      browser.assert.elements('section img', 2);
      done();
    });
  });
});
