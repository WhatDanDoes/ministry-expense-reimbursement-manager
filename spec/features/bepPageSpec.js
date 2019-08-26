const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
Browser.localhost('example.com', PORT);
//const fs = require('fs');
const app = require('../../app');

/**
 * `mock-fs` stubs the entire file system. So if a module hasn't
 * already been `require`d the tests will fail because the 
 * module doesn't exist in the mocked file system. `ejs` and
 * `iconv-lite/encodings` are required here to solve that 
 * problem.
 */
const mock = require('mock-fs');
const mockAndUnmock = require('../support/mockAndUnmock')(mock);

describe('BasicPhotoEconomizer about page', () => {
  const browser = new Browser();

  beforeEach(done => {
    done();
  });

  afterEach(() => {
    mock.restore();
  });

  it('displays the page title set in .env', done => { 
    browser.visit('/bep', (err) => {
      if (err) return done.fail(err);
      browser.assert.success();
      browser.assert.text('#page a', 'Ministry Expense Reimbursement Manager');
      done();
    });
  });
});
