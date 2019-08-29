'use strict';

const fixtures = require('pow-mongoose-fixtures');
const models = require('../../models'); 

const app = require('../../app'); 
const request = require('supertest');

const fs = require('fs');
const mkdirp = require('mkdirp');

const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
Browser.localhost('example.com', PORT);

/**
 * `mock-fs` stubs the entire file system. So if a module hasn't
 * already been `require`d the tests will fail because the 
 * module doesn't exist in the mocked file system. `ejs` and
 * `iconv-lite/encodings` are required here to solve that 
 * problem.
 */
const mock = require('mock-fs');
const mockAndUnmock = require('../support/mockAndUnmock')(mock);

// For when system resources are scarce
jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe('imagePublish - POST /image/:domain/:agentId/:imageId', function() {

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

  describe('unauthenticated', function() {
    it('does not allow publishing an image', function(done) {
      request(app)
        .put(`/image/${agent.getAgentDirectory()}/image2.jpg`)
        .end(function(err, res) {
          if (err) return done.fail(err);
          expect(res.status).toEqual(302);
          expect(res.header.location).toEqual('/');
          done();
        });
    });
  });

  describe('authenticated', function() {
    beforeEach(done => {
      mockAndUnmock({ 
        [`uploads/${agent.getAgentDirectory()}`]: {
          'image1.jpg': fs.readFileSync('spec/files/troll.jpg'),
          'image2.pdf': fs.readFileSync('spec/files/troll.jpg'),
          'image3.jpg': fs.readFileSync('spec/files/troll.jpg'),
        },
        [`uploads/${lanny.getAgentDirectory()}`]: {
          'lanny1.jpg': fs.readFileSync('spec/files/troll.jpg'),
          'lanny2.jpg': fs.readFileSync('spec/files/troll.jpg'),
          'lanny3.jpg': fs.readFileSync('spec/files/troll.jpg'),
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

    describe('publishing', function() {
      describe('owner resource', function() {
        beforeEach(function(done) {
          browser.clickLink(`a[href="/image/${agent.getAgentDirectory()}/image1.jpg"]`, (err) => {
            if (err) return done.fail(err);
            browser.assert.success();
            done();
          });
        });

        it('renders a form to allow an agent to publish an image', () => {
          browser.assert.element('#publish-image-form');
          browser.assert.element(`form[action="/image/${agent.getAgentDirectory()}/image1.jpg?_method=PUT"][method="post"]`);
        });

        it('adds an invoice record to the database', function(done) {
          models.Invoice.find({}).then((invoices) => {
            expect(invoices.length).toEqual(0);

            browser.fill('#datepicker', '2019-08-09');
            browser.fill('#total', '7.9');
            browser.select('#category-dropdown', '110 - Commercial Travel');
            browser.fill('#reason', 'Lime scooter for 2km');
            browser.pressButton('Save', function(err) {
              if (err) return done.fail(err);
              browser.assert.success();
              models.Invoice.find({}).then((invoices) => {
                expect(invoices.length).toEqual(1);
                done();
              }).catch(function(error) {
                 done.fail(error);
              });
            });
          }).catch(function(error) {
            done.fail(error);
          });
        });

        it('redirects to the agent image route if the publish is successful', function(done) {
          browser.visit('/image', err => {
            if (err) return done.fail(err);
            browser.assert.success();
            browser.assert.element(`.image a[href="/image/${agent.getAgentDirectory()}/image1.jpg"] + .edit-mark`);
            browser.assert.elements(`.image a[href="/image/${agent.getAgentDirectory()}/image1.jpg"] + .check-mark`, 0);
            browser.clickLink(`a[href="/image/${agent.getAgentDirectory()}/image1.jpg"]`, (err) => {
              if (err) return done.fail(err);

              browser.fill('#datepicker', '2019-08-09');
              browser.fill('#total', '7.9');
              browser.select('#category-dropdown', '110 - Commercial Travel');
              browser.fill('#reason', 'Lime scooter for 2km');
              browser.pressButton('Save', function(err) {
                if (err) return done.fail(err);
                browser.assert.success();
                browser.assert.text('.alert.alert-success', 'Invoice saved');
                browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}` });
                browser.assert.element(`.image a[href="/image/${agent.getAgentDirectory()}/image1.jpg"] + .check-mark`);
                browser.assert.elements(`.link a[href="/image/${agent.getAgentDirectory()}/image1.jpg"] + .edit-mark`, 0);
                done();
              });
            });
          });
        });

        it('shows a check-mark on a non-image if publish is successful', function(done) {
          browser.visit('/image', err => {
            if (err) return done.fail(err);
            browser.assert.success();
            browser.assert.element(`.link a[href="/image/${agent.getAgentDirectory()}/image2.pdf"] + .edit-mark`);
            browser.assert.elements(`.link a[href="/image/${agent.getAgentDirectory()}/image2.pdf"] + .check-mark`, 0);
            browser.clickLink(`a[href="/image/${agent.getAgentDirectory()}/image2.pdf"]`, (err) => {
              if (err) return done.fail(err);
              browser.assert.success();

              browser.fill('#datepicker', '2019-08-09');
              browser.fill('#total', '7.9');
              browser.select('#category-dropdown', '110 - Commercial Travel');
              browser.fill('#reason', 'Lime scooter for 2km');
              browser.pressButton('Save', function(err) {
                if (err) return done.fail(err);
                browser.assert.success();
                browser.assert.text('.alert.alert-success', 'Invoice saved');
                browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}` });
                browser.assert.element(`.link a[href="/image/${agent.getAgentDirectory()}/image2.pdf"] + .check-mark`);
                browser.assert.elements(`.link a[href="/image/${agent.getAgentDirectory()}/image2.pdf"] + .edit-mark`, 0);
                done();
              });
            });
          });
        });

        describe('non-Canadian currencies', () => {
          it('displays a exchangeRate spinner when CAD is not selected', done => {
            browser.assert.style('#exchange-rate', 'display', 'none');
            browser.fill('#currency-selector', 'USD', function(err) {
              if (err) return done.fail(err);
              browser.assert.style('#exchange-rate', 'display', 'block');
              browser.fill('#currency-selector', 'CAD', function(err) {
                if (err) return done.fail(err);
                browser.assert.style('#exchange-rate', 'display', 'none');
                done();
              });
            });
          });

          it('displays the currency and exchangeRate when invoice not in CAD', done => {
            browser.fill('#datepicker', '2019-08-09');
            browser.fill('#total', '7.9');
            browser.fill('#currency-selector', 'USD');
            browser.fill('input[name=exchangeRate]', 1.35);
            browser.select('#category-dropdown', '110 - Commercial Travel');
            browser.fill('#reason', 'Lime scooter for 2km');
            browser.pressButton('Save', function(err) {
              if (err) return done.fail(err);
              browser.assert.success();
              browser.clickLink(`a[href="/image/${agent.getAgentDirectory()}/image1.jpg"]`, (err) => {
                if (err) return done.fail(err);
                browser.assert.success();
                browser.assert.style('#exchange-rate', 'display', 'block');
                browser.assert.element('form input[name=exchangeRate][type=number][value="1.35"]');
                browser.assert.element('form input[name=currency][value=USD][list=currencies]');
                done();
              });
            });
          });

          it('resets exchange rate when currency set back to CAD', done => {
            browser.fill('#datepicker', '2019-08-09');
            browser.fill('#total', '7.9');
            browser.fill('#currency-selector', 'USD');
            browser.fill('input[name=exchangeRate]', 1.35);
            browser.select('#category-dropdown', '110 - Commercial Travel');
            browser.fill('#reason', 'Lime scooter for 2km');
            browser.pressButton('Save', function(err) {
              if (err) return done.fail(err);
              browser.assert.success();
              browser.clickLink(`a[href="/image/${agent.getAgentDirectory()}/image1.jpg"]`, (err) => {
                if (err) return done.fail(err);
                browser.assert.success();
                browser.assert.style('#exchange-rate', 'display', 'block');
                browser.assert.element('form input[name=exchangeRate][type=number][value="1.35"]');
                browser.assert.element('form input[name=currency][value=USD][list=currencies]');

                browser.fill('#currency-selector', 'CAD');
                browser.pressButton('Save', function(err) {
                  if (err) return done.fail(err);
                  browser.clickLink(`a[href="/image/${agent.getAgentDirectory()}/image1.jpg"]`, (err) => {
                    if (err) return done.fail(err);
                    browser.assert.success();

                    browser.assert.style('#exchange-rate', 'display', 'none');
                    browser.assert.element('form input[name=exchangeRate][type=number][value="1"]');
                    browser.assert.element('form input[name=currency][value=CAD][list=currencies]');

                    done();
                  });
                });
              });
            });
          });
        });

        describe('invalid currencies', () => {
          it('performs validation', done => {
            browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}/image1.jpg` });
            browser.fill('#datepicker', '2019-08-28');
            browser.fill('#total', '7.9');
            browser.fill('#currency-selector', 'BTC');
            browser.fill('input[name=exchangeRate]', 0.00013);
            browser.select('#category-dropdown', '110 - Commercial Travel');
            browser.fill('#reason', 'Helicopter for language survey');
            browser.pressButton('Save', function(err) {
              if (err) return done.fail(err);
              browser.assert.success();
              browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}/image1.jpg` });
              browser.assert.text('.alert.alert-danger', 'Unknown currency');

              browser.assert.style('#exchange-rate', 'display', 'block');
              browser.assert.element('form input[name=purchaseDate][type=number][value="2019-08-28"]');
              browser.assert.element('form input[name=total][type=number][value="7.90"]');
              browser.assert.element('form input[name=exchangeRate][type=number][value="0.00013"]');
              browser.assert.element('form input[name=currency][value=BTC][list=currencies]');
              browser.assert.element('form input[name=category] option[value="110"][selected=selected]');
              browser.assert.element('form input[name=reason][value="Helicopter for language survey"]');
              done();
            });
          });
        });

        describe('editing existing invoice', () => {
          beforeEach(function(done) {
            browser.fill('#datepicker', '2019-08-09');
            browser.fill('#total', '7.9');
            browser.select('#category-dropdown', '110 - Commercial Travel');
            browser.fill('#reason', 'Lime scooter for 2km');
            browser.pressButton('Save', function(err) {
              if (err) return done.fail(err);
              browser.assert.success();
              browser.clickLink(`a[href="/image/${agent.getAgentDirectory()}/image1.jpg"]`, (err) => {
                if (err) return done.fail(err);
                browser.assert.success();
                done();
              });
            });
          });

          it('redirects to the agent image route if the update is successful', function(done) {
            browser.fill('#total', '87.89');
            browser.pressButton('Save', function(err) {
              if (err) return done.fail(err);
              browser.assert.success();
              browser.assert.text('.alert.alert-success', 'Invoice saved');
              browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}` });

              browser.assert.element(`.image a[href="/image/${agent.getAgentDirectory()}/image1.jpg"] + .check-mark`);
              browser.clickLink(`a[href="/image/${agent.getAgentDirectory()}/image1.jpg"]`, (err) => {
                if (err) return done.fail(err);
                browser.assert.success();

                browser.assert.element(`img[src="/uploads/${agent.getAgentDirectory()}/image1.jpg"]`);
                browser.assert.element('form select[name=category]', '110 - Commercial Travel');
                browser.assert.elements('form select[name=category] option', 21);
                browser.assert.input('form input[name=total]', '87.89');
                browser.assert.input('form input[name=reason]', 'Lime scooter for 2km');
                browser.assert.element(`form input[name=purchaseDate][value='2019-08-09']` );

                done();
              });
            });
          });
        });
      });

      describe('readable resource', function() {
        beforeEach(function(done) {
          browser.visit(`/image/${lanny.getAgentDirectory()}/image1.jpg`, (err) => {
            if (err) return done.fail(err);
            browser.assert.success();
            done();
          });
        });

        it('does not show a publish or delete button', () => {
          browser.assert.elements('#publish-image-button', 0);
          browser.assert.elements('#delete-image-form', 0);
        });

        it('does not remove the image from the agent\'s directory', function(done) {
          fs.readdir(`uploads/${lanny.getAgentDirectory()}`, (err, files) => {
            if (err) return done.fail(err);
            expect(files.length).toEqual(3);
            expect(files.includes('lanny1.jpg')).toBe(true);

            request(app)
              .put(`/image/${lanny.getAgentDirectory()}/lanny1.jpg`)
              .set('Cookie', browser.cookies)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.status).toEqual(302);
                expect(res.header.location).toEqual(`/image/${lanny.getAgentDirectory()}`);

                fs.readdir(`uploads/${lanny.getAgentDirectory()}`, (err, files) => {
                  if (err) return done.fail(err);
                  expect(files.length).toEqual(3);
                  expect(files.includes('lanny1.jpg')).toBe(true);

                  fs.readdir(`public/images/uploads`, (err, files) => {
                    if (err) return done.fail(err);
                    expect(files.length).toEqual(0);
                    expect(files.includes('image1.jpg')).toBe(false);

                    done();
                  });
                });
              });
          });
        });

        it('does not add an invoice record to the database', function(done) {
          models.Invoice.find({}).then((invoices) => {
            expect(invoices.length).toEqual(0);

            request(app)
              .put(`/image/${lanny.getAgentDirectory()}/lanny1.jpg`)
              .set('Cookie', browser.cookies)
              .field('#datepicker', '2019-08-09')
              .field('#total', '7.9')
              .field('#category', 110)
              .field('#reason', 'Fun and adventure')
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.status).toEqual(302);
                expect(res.header.location).toEqual(`/image/${lanny.getAgentDirectory()}`);

                models.Invoice.find({}).then((invoices) => {
                  expect(invoices.length).toEqual(0);
                  done();
                }).catch(function(error) {
                   done.fail(error);
                });
            });
          }).catch(function(error) {
            done.fail(error);
          });
        });
      });

      describe('unauthorized resource', function() {
        let troy;
        beforeEach(function(done) {
          agent.canWrite.pop();
          agent.save().then(result => {
            models.Agent.findOne({ email: 'troy@example.com' }).then(function(result) {
              troy = result;

              expect(agent.canRead.length).toEqual(1);
              expect(agent.canRead[0]).not.toEqual(troy._id);
              expect(agent.canWrite.length).toEqual(0);

              browser.visit(`/image/${troy.getAgentDirectory()}/somepic.jpg`, function(err) {
                if (err) return done.fail(err);
                done();
              });
            }).catch(function(error) {
              done.fail(error);
            });
          }).catch(function(error) {
            done.fail(error);
          });
        });

        it('redirects home', () => {
          browser.assert.redirected();
          browser.assert.url({ pathname: '/'});
          browser.assert.text('.alert.alert-danger', 'You are not authorized to access that resource');
        });

        it('does not add an invoice record to the database', function(done) {
          models.Invoice.find({}).then((invoices) => {
            expect(invoices.length).toEqual(0);

            request(app)
              .put(`/image/${lanny.getAgentDirectory()}/lanny1.jpg`)
              .set('Cookie', browser.cookies)
              .field('#datepicker', '2019-08-09')
              .field('#total', '7.9')
              .field('#category', 110)
              .field('#reason', 'Fun and adventure')
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.status).toEqual(302);
                expect(res.header.location).toEqual(`/image/${lanny.getAgentDirectory()}`);

                models.Invoice.find({}).then((invoices) => {
                  expect(invoices.length).toEqual(0);
                  done();
                }).catch(function(error) {
                   done.fail(error);
                });
            });
          }).catch(function(error) {
            done.fail(error);
          });
        });
      });

      describe('writable resource', function() {
        beforeEach(function(done) {
          browser.visit(`/image/${troy.getAgentDirectory()}/troy1.jpg`, (err) => {
            if (err) return done.fail(err);
            browser.assert.success();
            done();
          });
        });

        it('renders a form to allow an agent to publish an image', () => {
          browser.assert.element('#publish-image-form');
          browser.assert.element(`form[action="/image/${troy.getAgentDirectory()}/troy1.jpg?_method=PUT"][method="post"]`);
        });

        it('adds an invoice record to the database', function(done) {
          models.Invoice.find({}).then((invoices) => {
            expect(invoices.length).toEqual(0);

            browser.fill('#datepicker', '2019-08-09');
            browser.fill('#total', '7.9');
            browser.select('#category-dropdown', '110 - Commercial Travel');
            browser.fill('#reason', 'Lime scooter for 2km');
            browser.pressButton('Save', function(err) {
              if (err) return done.fail(err);
              browser.assert.success();
              models.Invoice.find({}).then((invoices) => {
                expect(invoices.length).toEqual(1);
                expect(invoices[0].agent).toEqual(troy._id);
                done();
              }).catch(function(error) {
                 done.fail(error);
              });
            });
          }).catch(function(error) {
            done.fail(error);
          });
        });

        it('redirects to the agent image route if the publish is successful', function(done) {
          browser.visit(`/image/${troy.getAgentDirectory()}`, err => {
            if (err) return done.fail(err);
            browser.assert.success();
            browser.assert.element(`.image a[href="/image/${troy.getAgentDirectory()}/troy1.jpg"] + .edit-mark`);
            browser.assert.elements(`.image a[href="/image/${troy.getAgentDirectory()}/troy1.jpg"] + .check-mark`, 0);
            browser.clickLink(`a[href="/image/${troy.getAgentDirectory()}/troy1.jpg"]`, (err) => {
              if (err) return done.fail(err);

              browser.fill('#datepicker', '2019-08-09');
              browser.fill('#total', '7.9');
              browser.select('#category-dropdown', '110 - Commercial Travel');
              browser.fill('#reason', 'Lime scooter for 2km');
              browser.pressButton('Save', function(err) {
                if (err) return done.fail(err);
                browser.assert.success();
                browser.assert.text('.alert.alert-success', 'Invoice saved');
                browser.assert.url({ pathname: `/image/${troy.getAgentDirectory()}` });
                browser.assert.element(`.image a[href="/image/${troy.getAgentDirectory()}/troy1.jpg"] + .check-mark`);
                browser.assert.elements(`.link a[href="/image/${troy.getAgentDirectory()}/troy1.jpg"] + .edit-mark`, 0);
                done();
              });
            });
          });
        });

        it('shows a check-mark on a non-image if publish is successful', function(done) {
          browser.visit(`/image/${troy.getAgentDirectory()}`, err => {
            if (err) return done.fail(err);
            browser.assert.success();
            browser.assert.element(`.link a[href="/image/${troy.getAgentDirectory()}/troy2.pdf"] + .edit-mark`);
            browser.assert.elements(`.link a[href="/image/${troy.getAgentDirectory()}/troy2.pdf"] + .check-mark`, 0);
            browser.clickLink(`a[href="/image/${troy.getAgentDirectory()}/troy2.pdf"]`, (err) => {
              if (err) return done.fail(err);
              browser.assert.success();

              browser.fill('#datepicker', '2019-08-09');
              browser.fill('#total', '7.9');
              browser.select('#category-dropdown', '110 - Commercial Travel');
              browser.fill('#reason', 'Lime scooter for 2km');
              browser.pressButton('Save', function(err) {
                if (err) return done.fail(err);
                browser.assert.success();
                browser.assert.text('.alert.alert-success', 'Invoice saved');
                browser.assert.url({ pathname: `/image/${troy.getAgentDirectory()}` });
                browser.assert.element(`.link a[href="/image/${troy.getAgentDirectory()}/troy2.pdf"] + .check-mark`);
                browser.assert.elements(`.link a[href="/image/${troy.getAgentDirectory()}/troy2.pdf"] + .edit-mark`, 0);
                done();
              });
            });
          });
        });

        describe('non-Canadian currencies', () => {
          it('displays a exchangeRate spinner when CAD is not selected', done => {
            browser.assert.style('#exchange-rate', 'display', 'none');
            browser.fill('#currency-selector', 'USD', function(err) {
              if (err) return done.fail(err);
              browser.assert.style('#exchange-rate', 'display', 'block');
              browser.fill('#currency-selector', 'CAD', function(err) {
                if (err) return done.fail(err);
                browser.assert.style('#exchange-rate', 'display', 'none');
                done();
              });
            });
          });

          it('displays the currency and exchangeRate when invoice not in CAD', done => {
            browser.fill('#datepicker', '2019-08-09');
            browser.fill('#total', '7.9');
            browser.fill('#currency-selector', 'USD');
            browser.fill('input[name=exchangeRate]', 1.35);
            browser.select('#category-dropdown', '110 - Commercial Travel');
            browser.fill('#reason', 'Lime scooter for 2km');
            browser.pressButton('Save', function(err) {
              if (err) return done.fail(err);
              browser.assert.success();
              browser.clickLink(`a[href="/image/${troy.getAgentDirectory()}/troy1.jpg"]`, (err) => {
                if (err) return done.fail(err);
                browser.assert.success();
                browser.assert.style('#exchange-rate', 'display', 'block');
                browser.assert.element('form input[name=exchangeRate][type=number][value="1.35"]');
                browser.assert.element('form input[name=currency][value=USD][list=currencies]');
                done();
              });
            });
          });

          it('resets exchange rate when currency set back to CAD', done => {
            browser.fill('#datepicker', '2019-08-09');
            browser.fill('#total', '7.9');
            browser.fill('#currency-selector', 'USD');
            browser.fill('input[name=exchangeRate]', 1.35);
            browser.select('#category-dropdown', '110 - Commercial Travel');
            browser.fill('#reason', 'Lime scooter for 2km');
            browser.pressButton('Save', function(err) {
              if (err) return done.fail(err);
              browser.assert.success();
              browser.clickLink(`a[href="/image/${troy.getAgentDirectory()}/troy1.jpg"]`, (err) => {
                if (err) return done.fail(err);
                browser.assert.success();
                browser.assert.style('#exchange-rate', 'display', 'block');
                browser.assert.element('form input[name=exchangeRate][type=number][value="1.35"]');
                browser.assert.element('form input[name=currency][value=USD][list=currencies]');

                browser.fill('#currency-selector', 'CAD');
                browser.pressButton('Save', function(err) {
                  if (err) return done.fail(err);
                  browser.clickLink(`a[href="/image/${troy.getAgentDirectory()}/troy1.jpg"]`, (err) => {
                    if (err) return done.fail(err);
                    browser.assert.success();

                    browser.assert.style('#exchange-rate', 'display', 'none');
                    browser.assert.element('form input[name=exchangeRate][type=number][value="1"]');
                    browser.assert.element('form input[name=currency][value=CAD][list=currencies]');

                    done();
                  });
                });
              });
            });
          });
        });

        describe('invalid currencies', () => {
          it('performs validation', done => {
            browser.assert.url({ pathname: `/image/${troy.getAgentDirectory()}/troy1.jpg` });
            browser.fill('#datepicker', '2019-08-28');
            browser.fill('#total', '7.9');
            browser.fill('#currency-selector', 'BTC');
            browser.fill('input[name=exchangeRate]', 0.00013);
            browser.select('#category-dropdown', '110 - Commercial Travel');
            browser.fill('#reason', 'Helicopter for language survey');
            browser.pressButton('Save', function(err) {
              if (err) return done.fail(err);
              browser.assert.success();
              browser.assert.url({ pathname: `/image/${troy.getAgentDirectory()}/troy1.jpg` });
              browser.assert.text('.alert.alert-danger', 'Unknown currency');

              browser.assert.style('#exchange-rate', 'display', 'block');
              browser.assert.element('form input[name=purchaseDate][type=number][value="2019-08-28"]');
              browser.assert.element('form input[name=total][type=number][value="7.90"]');
              browser.assert.element('form input[name=exchangeRate][type=number][value="0.00013"]');
              browser.assert.element('form input[name=currency][value=BTC][list=currencies]');
              browser.assert.element('form input[name=category] option[value="110"][selected=selected]');
              browser.assert.element('form input[name=reason][value="Helicopter for language survey"]');
              done();
            });
          });
        });

        describe('editing existing invoice', () => {
          beforeEach(function(done) {
            browser.fill('#datepicker', '2019-08-09');
            browser.fill('#total', '7.9');
            browser.select('#category-dropdown', '110 - Commercial Travel');
            browser.fill('#reason', 'Lime scooter for 2km');
            browser.pressButton('Save', function(err) {
              if (err) return done.fail(err);
              browser.assert.success();
              browser.clickLink(`a[href="/image/${troy.getAgentDirectory()}/troy1.jpg"]`, (err) => {
                if (err) return done.fail(err);
                browser.assert.success();
                done();
              });
            });
          });

          it('redirects to the agent image route if the update is successful', function(done) {
            browser.fill('#total', '87.89');
            browser.pressButton('Save', function(err) {
              if (err) return done.fail(err);
              browser.assert.success();
              browser.assert.text('.alert.alert-success', 'Invoice saved');
              browser.assert.url({ pathname: `/image/${troy.getAgentDirectory()}` });

              browser.assert.element(`.image a[href="/image/${troy.getAgentDirectory()}/troy1.jpg"] + .check-mark`);
              browser.clickLink(`a[href="/image/${troy.getAgentDirectory()}/troy1.jpg"]`, (err) => {
                if (err) return done.fail(err);
                browser.assert.success();

                browser.assert.element(`img[src="/uploads/${troy.getAgentDirectory()}/troy1.jpg"]`);
                browser.assert.element('form select[name=category]', '110 - Commercial Travel');
                browser.assert.elements('form select[name=category] option', 21);
                browser.assert.input('form input[name=total]', '87.89');
                browser.assert.input('form input[name=reason]', 'Lime scooter for 2km');
                browser.assert.element(`form input[name=purchaseDate][value='2019-08-09']` );

                done();
              });
            });
          });
        });
      });
    });
  });
});
