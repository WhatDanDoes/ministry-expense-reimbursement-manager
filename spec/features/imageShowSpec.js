const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
Browser.localhost('example.com', PORT);
const fs = require('fs');
const app = require('../../app');
const fixtures = require('pow-mongoose-fixtures');
const models = require('../../models'); 
const moment = require('moment'); 

/**
 * `mock-fs` stubs the entire file system. So if a module hasn't
 * already been `require`d the tests will fail because the 
 * module doesn't exist in the mocked file system. `ejs` and
 * `iconv-lite/encodings` are required here to solve that 
 * problem.
 */
const mock = require('mock-fs');
const mockAndUnmock = require('../support/mockAndUnmock')(mock);

describe('imageShowSpec', () => {
  let browser, agent, lanny, troy;

  beforeEach(function(done) {
    browser = new Browser({ waitDuration: '30s', loadCss: false });
    //browser.debug();
    fixtures.load(__dirname + '/../fixtures/agents.js', models.mongoose, function(err) {
      models.Agent.findOne({ email: 'daniel@example.com' }).then(function(results) {
        agent = results;
        models.Agent.findOne({ email: 'lanny@example.com' }).then(function(results) {
          lanny = results;
          models.Agent.findOne({ email: 'troy@example.com' }).then(function(results) {
            troy = results;
            browser.visit('/', function(err) {
              if (err) return done.fail(err);
              browser.assert.success();
              done();
            });
          }).catch(function(error) {
            done.fail(error);
          });
        }).catch(function(error) {
          done.fail(error);
        });
      }).catch(function(error) {
        done.fail(error);
      });
    });
  });

  afterEach(function(done) {
    models.mongoose.connection.db.dropDatabase().then(function(err, result) {
      done();
    }).catch(function(err) {
      done.fail(err);
    });
  });

  describe('authenticated', () => {
    beforeEach(done => {
      mockAndUnmock({ 
        [`uploads/${agent.getAgentDirectory()}`]: {
          'image1.jpg': fs.readFileSync('spec/files/troll.jpg'),
          'image2.jpg': fs.readFileSync('spec/files/troll.jpg'),
          'image3.pdf': fs.readFileSync('spec/files/troll.jpg'),
        },
        [`uploads/${troy.getAgentDirectory()}`]: {
          'troy1.jpg': fs.readFileSync('spec/files/troll.jpg'),
          'troy2.pdf': fs.readFileSync('spec/files/troll.jpg'),
        },
        'public/images/uploads': {}
      });

      browser.fill('email', agent.email);
      browser.fill('password', 'secret');
      browser.pressButton('Login', function(err) {
        if (err) done.fail(err);
        browser.assert.success();
        done();
      });
    });

    afterEach(() => {
      mock.restore();
    });

    describe('authorized', () => {
      describe('viewing an image an agent owns', () => {
        it('it renders interface without an associated receipt', done => {
          browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}`});
          browser.assert.element(`.image a[href="/image/${agent.getAgentDirectory()}/image1.jpg"] img[src="/uploads/${agent.getAgentDirectory()}/image1.jpg"]`);
          browser.clickLink(`a[href="/image/${agent.getAgentDirectory()}/image1.jpg"]`, (err) => {
            if (err) return done.fail(err);
            browser.assert.success();
            // Image
            browser.assert.element(`img[src="/uploads/${agent.getAgentDirectory()}/image1.jpg"]`);
            // Delete
            browser.assert.element('#delete-image-form');
            // Cancel
            browser.assert.element('#cancel-edit-form');
            // Publish
            browser.assert.element('#publish-image-form');
            // Info form
            // Category selector
            browser.assert.element('form select[name=category]');
            browser.assert.elements('form select[name=category] option', 21);
            // Total
            browser.assert.input('form input[name=total]', '');
            // Currency
            browser.assert.element('form input[name=currency][value=CAD][list=currencies]');
            browser.assert.elements('form datalist#currencies option', 4);
            // Exchange Rate (not visible)
            browser.assert.style('#exchange-rate', 'display', 'none');
            // Reason
            browser.assert.input('form input[name=reason]', '');
            // Date
            browser.assert.element(`form input[name=purchaseDate][value="${moment().format('YYYY-MM-DD')}"]` );

            done();
          });
        });

        it('it renders interface with an associated receipt', done => {
          const invoice = {
            category: 110,
            purchaseDate: new Date('2019-08-08'),
            reason: 'Lime scooter for 2 km',
            doc: `${agent.getAgentDirectory()}/image1.jpg`,
            total: '7.90',
            agent: agent._id,
          };
          models.Invoice.create(invoice).then((invoice) => {
            browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}`});
            browser.assert.element(`.image a[href="/image/${agent.getAgentDirectory()}/image1.jpg"] img[src="/uploads/${agent.getAgentDirectory()}/image1.jpg"]`);
            browser.clickLink(`a[href="/image/${agent.getAgentDirectory()}/image1.jpg"]`, (err) => {
              if (err) return done.fail(err);
              browser.assert.success();
              // Image
              browser.assert.element(`img[src="/uploads/${agent.getAgentDirectory()}/image1.jpg"]`);
              // Delete
              browser.assert.element('#delete-image-form');
              // Cancel
              browser.assert.element('#cancel-edit-form');
              // Publish
              browser.assert.element('#publish-image-form');
              // Info form
              // Category selector
              browser.assert.element('form select[name=category]', '110 - Commercial Travel');
              browser.assert.elements('form select[name=category] option', 21);
              browser.assert.element('form select[name=category] option[value="110"][selected=selected]');
              // Total
              browser.assert.input('form input[name=total]', '7.90');
              // Currency
              browser.assert.element('form input[name=currency][value=CAD][list=currencies]');
              browser.assert.elements('form datalist#currencies option', 4);
              // Exchange Rate (not visible)
              browser.assert.style('#exchange-rate', 'display', 'none');
              // Reason
              browser.assert.input('form input[name=reason]', 'Lime scooter for 2 km');
              // Date
              browser.assert.element(`form input[name=purchaseDate][value='2019-08-08']` );

              done();
            });
          }).catch((err) => {
            done.fail(err);
          });
        });

        it('allows an agent to view his own non-image document', done => {
          browser.clickLink(`a[href="/image/${agent.getAgentDirectory()}/image3.pdf"]`, (err) => {
            if (err) return done.fail(err);
            browser.assert.success();
            browser.assert.element(`a[href="/uploads/${agent.getAgentDirectory()}/image3.pdf"]`);
            browser.assert.elements('#delete-image-form', 1);
            done();
          });
        });

        it('allows an agent to cancel and return to the image roll', done => {
          browser.clickLink(`a[href="/image/${agent.getAgentDirectory()}/image3.pdf"]`, (err) => {
            if (err) return done.fail(err);
            browser.assert.success();
            browser.pressButton('Cancel', err => {
              if (err) return done.fail(err);
              browser.assert.success();
              browser.assert.url(`/image/${agent.getAgentDirectory()}`);
              done();
            });
          });
        });
      });

      describe('viewing an image to which an agent has permission to read', () => {
        it('renders without associated invoice', done => {
          expect(agent.canRead.length).toEqual(1);
          expect(agent.canRead[0]).toEqual(lanny._id);

          browser.visit(`/image/${lanny.getAgentDirectory()}/lanny1.jpg`, function(err) {
            if (err) return done.fail(err);
            browser.assert.success();
            browser.assert.element(`img[src="/uploads/${lanny.getAgentDirectory()}/lanny1.jpg"]`);
            browser.assert.elements('#delete-image-form', 0);
            browser.assert.elements('#publish-image-form', 1);
            browser.assert.elements('#publish-image-button', 0);

            // Info form
            // Category selector
            browser.assert.element('form select[name=category][disabled=disabled]');
            // Total
            browser.assert.input('form input[name=total][disabled=disabled]', '');
            // Currency
            browser.assert.element('form input[name=currency][value=CAD][list=currencies][disabled=disabled]');
            // Reason
            browser.assert.input('form input[name=reason][disabled=disabled]', '');
            // Date
            browser.assert.element(`form input[name=purchaseDate][value=''][disabled=disabled]` );
            done();
          });
        });

        it('renders with associated invoice', done => {
          expect(agent.canRead.length).toEqual(1);
          expect(agent.canRead[0]).toEqual(lanny._id);

          const invoice = {
            category: 110,
            purchaseDate: new Date('2019-08-08'),
            reason: 'Lime scooter for 2 km',
            doc: `${lanny.getAgentDirectory()}/lanny1.jpg`,
            total: '7.90',
            agent: lanny._id,
          };
          models.Invoice.create(invoice).then((invoice) => {
            browser.visit(`/image/${lanny.getAgentDirectory()}/lanny1.jpg`, function(err) {
              if (err) return done.fail(err);
              browser.assert.success();
              browser.assert.element(`img[src="/uploads/${lanny.getAgentDirectory()}/lanny1.jpg"]`);
              browser.assert.elements('#delete-image-form', 0);
              browser.assert.elements('#publish-image-form', 1);
              browser.assert.elements('#publish-image-button', 0);

              // Info form
              // Category selector
              browser.assert.element('form select[name=category][disabled=disabled]');
              browser.assert.element('form select[name=category] option[value="110"][selected=selected]');
              // Total
              browser.assert.input('form input[name=total][disabled=disabled]', '7.90');
              // Currency
              browser.assert.element('form input[name=currency][value=CAD][list=currencies][disabled=disabled]');
              // Reason
              browser.assert.input('form input[name=reason][disabled=disabled]', 'Lime scooter for 2 km');
              // Date
              browser.assert.element(`form input[name=purchaseDate][value='2019-08-08'][disabled=disabled]`);
              done();
            });
          }).catch((err) => {
            done.fail(err);
          });
        });

        it('allows an agent to cancel and return to the owner agent\'s image roll', done => {
          browser.visit(`/image/${lanny.getAgentDirectory()}/lanny1.jpg`, function(err) {
            if (err) return done.fail(err);
            browser.assert.success();
            browser.pressButton('Cancel', err => {
              if (err) return done.fail(err);
              browser.assert.success();
              browser.assert.url(`/image/${lanny.getAgentDirectory()}`);
              done();
            });
          });
        });
      });

      describe('viewing a writable image', () => {
        beforeEach(done => {
          browser.visit(`/image/${troy.getAgentDirectory()}`, (err) => {
            if (err) return done.fail(err);
            browser.assert.success();
            done();
          });
        });

        it('it renders interface without an associated receipt', done => {
          browser.assert.url({ pathname: `/image/${troy.getAgentDirectory()}`});
          browser.assert.element(`.image a[href="/image/${troy.getAgentDirectory()}/troy1.jpg"] img[src="/uploads/${troy.getAgentDirectory()}/troy1.jpg"]`);
          browser.clickLink(`a[href="/image/${troy.getAgentDirectory()}/troy1.jpg"]`, (err) => {
            if (err) return done.fail(err);
            browser.assert.success();
            // Image
            browser.assert.element(`img[src="/uploads/${troy.getAgentDirectory()}/troy1.jpg"]`);
            // Delete
            browser.assert.element('#delete-image-form');
            // Cancel
            browser.assert.element('#cancel-edit-form');
            // Publish
            browser.assert.element('#publish-image-form');
            // Info form
            // Category selector
            browser.assert.element('form select[name=category]');
            browser.assert.elements('form select[name=category] option', 21);
            // Total
            browser.assert.input('form input[name=total]', '');
            // Currency
            browser.assert.element('form input[name=currency][value=CAD][list=currencies]');
            browser.assert.elements('form datalist#currencies option', 4);
            // Exchange Rate (not visible)
            browser.assert.style('#exchange-rate', 'display', 'none');
            // Reason
            browser.assert.input('form input[name=reason]', '');
            // Date
            browser.assert.element(`form input[name=purchaseDate][value="${moment().format('YYYY-MM-DD')}"]` );

            done();
          });
        });

        it('it renders interface with an associated receipt', done => {
          const invoice = {
            category: 110,
            purchaseDate: new Date('2019-08-08'),
            reason: 'Lime scooter for 2 km',
            doc: `${troy.getAgentDirectory()}/troy1.jpg`,
            total: '7.90',
            agent: troy._id,
          };
          models.Invoice.create(invoice).then((invoice) => {
            browser.assert.url({ pathname: `/image/${troy.getAgentDirectory()}`});
            browser.assert.element(`.image a[href="/image/${troy.getAgentDirectory()}/troy1.jpg"] img[src="/uploads/${troy.getAgentDirectory()}/troy1.jpg"]`);
            browser.clickLink(`a[href="/image/${troy.getAgentDirectory()}/troy1.jpg"]`, (err) => {
              if (err) return done.fail(err);
              browser.assert.success();
              // Image
              browser.assert.element(`img[src="/uploads/${troy.getAgentDirectory()}/troy1.jpg"]`);
              // Delete
              browser.assert.element('#delete-image-form');
              // Cancel
              browser.assert.element('#cancel-edit-form');
              // Publish
              browser.assert.element('#publish-image-form');
              // Info form
              // Category selector
              browser.assert.element('form select[name=category]', '110 - Commercial Travel');
              browser.assert.elements('form select[name=category] option', 21);
              browser.assert.element('form select[name=category] option[value="110"][selected=selected]');
              // Total
              browser.assert.input('form input[name=total]', '7.90');
              // Currency
              browser.assert.element('form input[name=currency][value=CAD][list=currencies]');
              browser.assert.elements('form datalist#currencies option', 4);
              // Exchange Rate (not visible)
              browser.assert.style('#exchange-rate', 'display', 'none');
              // Reason
              browser.assert.input('form input[name=reason]', 'Lime scooter for 2 km');
              // Date
              browser.assert.element(`form input[name=purchaseDate][value='2019-08-08']` );

              done();
            });
          }).catch((err) => {
            done.fail(err);
          });
        });

        it('allows an agent to view his own non-image document', done => {
          browser.clickLink(`a[href="/image/${troy.getAgentDirectory()}/troy2.pdf"]`, (err) => {
            if (err) return done.fail(err);
            browser.assert.success();
            browser.assert.element(`a[href="/uploads/${troy.getAgentDirectory()}/troy2.pdf"]`);
            browser.assert.elements('#delete-image-form', 1);
            done();
          });
        });

        it('allows an agent to cancel and return to the owner agent\'s image roll', done => {
          browser.clickLink(`a[href="/image/${troy.getAgentDirectory()}/troy2.pdf"]`, (err) => {
            if (err) return done.fail(err);
            browser.assert.success();
            browser.pressButton('Cancel', err => {
              if (err) return done.fail(err);
              browser.assert.success();
              browser.assert.url(`/image/${troy.getAgentDirectory()}`);
              done();
            });
          });
        });
      });
    });

    describe('unauthorized', () => {
      it('does not allow an agent to view an album for which he has not been granted access', done => {
        agent.canWrite.pop();
        agent.save().then(result => {
          models.Agent.findOne({ email: 'troy@example.com' }).then(function(troy) {
            expect(agent.canRead.length).toEqual(1);
            expect(agent.canRead[0]).not.toEqual(troy._id);

            browser.visit(`/image/${troy.getAgentDirectory()}/somepic.jpg`, function(err) {
              if (err) return done.fail(err);
              browser.assert.redirected();
              browser.assert.url({ pathname: '/'});
              browser.assert.text('.alert.alert-danger', 'You are not authorized to access that resource');
              done();
            });
          }).catch(function(error) {
            done.fail(error);
          });
        }).catch(function(error) {
          done.fail(error);
        });
      });
    });
  });

  describe('unauthenticated', () => {
    it('redirects home (which is where the login form is located)', done => {
      browser.visit(`/image/${agent.getAgentDirectory()}/image2.jpg`, function(err) {
        if (err) return done.fail(err);
        browser.assert.redirected();
        browser.assert.url({ pathname: '/'});
        browser.assert.text('.alert.alert-danger', 'You need to login first');
        done();
      });
    });
  });
});
