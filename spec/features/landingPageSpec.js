const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
Browser.localhost('example.com', PORT);
const app = require('../../app');

describe('landing page', () => {
  const browser = new Browser();

  it('displays the page title set in .env', done => { 
    browser.visit('/', (err) => {
      if (err) return done.fail(err);
      browser.assert.success();
      browser.assert.text('#page a .splash', 'Ministry Expense Reimbursement Manager');
      done();
    });
  });

  it('displays a message', done => {
    browser.visit('/', (err) => {
      if (err) return done.fail(err);
      browser.assert.success();
      browser.assert.text('.copy:last-of-type h1', 'Is merman right for you?');
      done();
    });
  });
});
