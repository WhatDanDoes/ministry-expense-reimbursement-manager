const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const DOMAIN = 'example.com';
Browser.localhost(DOMAIN, PORT);

const fs = require('fs');
const app = require('../../app');
const fixtures = require('pow-mongoose-fixtures');
const models = require('../../models');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const AdmZip = require('adm-zip');

const stubAuth0Sessions = require('../support/stubAuth0Sessions');

/**
 * `mock-fs` stubs the entire file system. So if a module hasn't
 * already been `require`d the tests will fail because the
 * module doesn't exist in the mocked file system. `ejs` and
 * `iconv-lite/encodings` are required here to solve that
 * problem.
 */
const mock = require('mock-fs');
const mockAndUnmock = require('../support/mockAndUnmock')(mock);

jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;

/**
 * Parses zip file returned from request (i.e., supertest) calls
 */
function binaryParser(res, callback) {
  res.setEncoding('binary');
  res.data = '';
  res.on('data', function (chunk) {
    res.data += chunk;
  });
  res.on('end', function () {
    callback(null, Buffer.from(res.data, 'binary'));
  });
}

describe('imageZipSpec', () => {
  let browser, agent, lanny, troy;

  beforeEach(function(done) {
    browser = new Browser({ waitDuration: '30s', loadCss: false });
    //browser.debug();
    fixtures.load(__dirname + '/../fixtures/agents.js', models.mongoose, function(err) {
      if (err) return done.fail(err);
      fixtures.load(__dirname + '/../fixtures/invoices.js', models.mongoose, function(err) {
        if (err) return done.fail(err);
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
  });

  afterEach(function(done) {
    models.mongoose.connection.db.dropDatabase().then((result) => {
      mock.restore();
      done();
    }).catch(function(err) {
      done.fail(err);
    });
  });

  describe('authenticated', () => {
    beforeEach(done => {
      stubAuth0Sessions(agent.email, DOMAIN, err => {
        if (err) done.fail(err);

        mockAndUnmock({
          [`uploads/${agent.getAgentDirectory()}`]: {
            'image1.jpg': fs.readFileSync('spec/files/troll.jpg'),
            'image2.pdf': fs.readFileSync('spec/files/troll.jpg'),
            'image3.GiF': fs.readFileSync('spec/files/troll.jpg'),
            'image4': fs.readFileSync('spec/files/troll.jpg'),
            'image5.jpg': fs.readFileSync('spec/files/troll.jpg'),
          },
          [`uploads/${lanny.getAgentDirectory()}`]: {
            'lanny1.jpg': fs.readFileSync('spec/files/troll.jpg'),
            'lanny2.jpg': fs.readFileSync('spec/files/troll.jpg'),
            'lanny3.jpg': fs.readFileSync('spec/files/troll.jpg'),
          },
          [`uploads/${troy.getAgentDirectory()}`]: {
            'troy1.jpg': fs.readFileSync('spec/files/troll.jpg'),
            'troy2.pdf': fs.readFileSync('spec/files/troll.jpg'),
            'troy3.GiF': fs.readFileSync('spec/files/troll.jpg'),
            'troy4': fs.readFileSync('spec/files/troll.jpg'),
            'troy5.jpg': fs.readFileSync('spec/files/troll.jpg'),
          },
          'public/images/uploads': {},
        });

        browser.clickLink('Login', err => {
          if (err) done.fail(err);
          browser.assert.success();

          models.Agent.findOne({ email: 'daniel@example.com' }).then(results => {
            agent = results;

            done();
          }).catch(err => {
            done.fail(err);
          });
        });
      });
    });

    describe('authorized', () => {
      describe('owner agent', () => {
        it('displays a link to zip and download the images if viewing his own album', () => {
          browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}`});
          browser.assert.element(`a[href="/image/${agent.getAgentDirectory()}/zip"]`);
        });

        it('does not display a link to zip and download the images if there are no images', (done) => {
          mock.restore();
          browser.visit(`/image/${agent.getAgentDirectory()}`, function(err) {
            if (err) return done.fail(err);
            browser.assert.success();
            browser.assert.elements('section.image img', 0);
            browser.assert.elements('section.link a', 0);
            browser.assert.elements(`a[href="/image/${agent.getAgentDirectory()}/zip"]`, 0);
            done();
          });
        });

        it('does not display a link to zip and download the images if none have been processed as invoices', (done) => {
          models.mongoose.connection.db.dropCollection('invoices').then(result => {
            browser.visit(`/image/${agent.getAgentDirectory()}`, function(err) {
              if (err) return done.fail(err);
              browser.assert.success();
              browser.assert.elements('section.image img', 3);
              browser.assert.elements('section.link a', 2);
              browser.assert.elements(`a[href="/image/${agent.getAgentDirectory()}/zip"]`, 0);
              done();
            });
          }).catch(function(err) {
            done.fail(err);
          });
        });

        describe('zipping contents', () => {

          describe('with no processed invoices', () => {
            it('returns an appropriate message if no images have been uploaded', (done) => {
              mock.restore();
              browser.clickLink('#zip-link', function(err) {
                if (err) done.fail(err);
                browser.assert.redirected();
                browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}`});
                browser.assert.text('.alert.alert-danger', 'You have no processed invoices');
                done();
              });
            });

            it('returns an appropriate message if no images have been processed as receipts', (done) => {
              models.mongoose.connection.db.dropCollection('invoices').then(result => {
                browser.clickLink('#zip-link', function(err) {
                  if (err) done.fail(err);
                  browser.assert.redirected();
                  browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}`});
                  browser.assert.text('.alert.alert-danger', 'You have no processed invoices');
                  done();
                });
              }).catch(function(err) {
                done.fail(err);
              });
            });
          });

          describe('with processed invoices', () => {
            let zipEntries;
            beforeEach(done => {
              request(app)
                .get(`/image/${agent.getAgentDirectory()}/zip`)
                .set('Cookie', browser.cookies)
                .expect(200)
                .expect( 'Content-Type', /application\/zip/ )
                .parse(binaryParser)
                .end(function(err, res) {
                  if (err) done.fail(err);

                  expect(Buffer.isBuffer(res.body)).toBe(true);

                  let zip = new AdmZip(res.body);
                  zipEntries = zip.getEntries();

                  // One file in zipEntries is the CSV and the other is an ODS (not to be counted in the image count)
                  expect(res.header['content-disposition']).toMatch(`${agent.getBaseFilename()} #1-${zipEntries.length-2}.zip`);

                  done();
                });
            });

            // The `gif` has no associated invoice (cf., `fixtures/invoices.js`)
            it('compresses the image directory and returns a zip file containing images processed as receipts', () => {
              expect(zipEntries.length).toEqual(5);
              expect(zipEntries[0].name).toEqual(`${agent._doc.name.split(' ').pop()} MER.csv`);
              expect(zipEntries[1].name).toEqual(`${agent._doc.name.split(' ').pop()} MER.xlsx`);
              expect(zipEntries[2].name).toEqual(`${agent.getBaseFilename()} #1.pdf`);
              expect(zipEntries[3].name).toEqual(`${agent.getBaseFilename()} #2`);
              expect(zipEntries[4].name).toEqual(`${agent.getBaseFilename()} #3.jpg`);
            });

            it('consolidates the invoice data in a CSV', done => {
              models.Invoice.find({}).sort({ purchaseDate: -1 }).then(invoices => {
                expect(invoices.length).toEqual(3);
                let csv = zipEntries[0].getData().toString('utf8')
                csv = csv.split('\n');
                expect(csv[0]).toEqual('"Category","Purchase Date","Item","Business Purpose of Expense","Receipt ref #","Local Amount","Currency Used","Exchange Rate"');
                expect(csv[1]).toEqual('"430","10 Aug \'19","Pens and staples","Supplies and Stationery",1,"9.65","CAD",1');
                expect(csv[2]).toEqual('"440","11 Aug \'19","Cloud server","Communication (Phone, Fax, E-mail)",2,"17.30","USD",1.35');
                expect(csv[3]).toEqual('"400","12 Aug \'19","Bible","Equipment",3,"65.99","CAD",1');
                done();
              }).catch(function(err) {
                done.fail(err);
              });
            });

            it('ignores archived files when zipping', done => {
              browser.pressButton('#archive-button', function(err) {
                if (err) done.fail(err);
                browser.assert.success();
                fs.writeFileSync(`uploads/${agent.getAgentDirectory()}/image6.jpg`, fs.readFileSync('spec/files/troll.jpg'));

                let newInvoice = new models.Invoice();
                newInvoice.category = 400;
                newInvoice.purchaseDate = new Date('2019-8-13');
                newInvoice.reason = 'Bible to feed my soul to live in eternity';
                newInvoice.total = 6599;
                newInvoice.doc = 'example.com/daniel/image6.jpg';
                newInvoice.agent = agent._id;

                newInvoice.save().then(result => {

                  request(app)
                    .get(`/image/${agent.getAgentDirectory()}/zip`)
                    .set('Cookie', browser.cookies)
                    .expect(200)
                    .expect( 'Content-Type', /application\/zip/ )
                    .parse(binaryParser)
                    .end(function(err, res) {
                      if (err) done.fail(err);

                      expect(Buffer.isBuffer(res.body)).toBe(true);

                      let zip = new AdmZip(res.body);
                      zipEntries = zip.getEntries();

                      // One file in zipEntries is the CSV and the other is an ODS (not to be counted in the image count)
                      expect(res.header['content-disposition']).toMatch(`${agent.getBaseFilename()} #1-${zipEntries.length-2}.zip`);
                      expect(zipEntries.length).toEqual(3);
                      expect(zipEntries[0].name).toEqual(`${agent._doc.name.split(' ').pop()} MER.csv`);
                      expect(zipEntries[1].name).toEqual(`${agent._doc.name.split(' ').pop()} MER.xlsx`);
                      expect(zipEntries[2].name).toEqual(`${agent.getBaseFilename()} #1.jpg`);

                      done();
                    });
                }).catch(err => {
                  done.fail(err);
                });
              });
            });
          });

          describe('with for/to regex-aware business purposes', () => {
            let zipEntries;
            beforeEach(done => {
              models.Invoice.find({agent: agent._id}).sort({ purchaseDate: -1 }).then(invoices => {
                expect(invoices.length).toEqual(3);
                invoices[0].reason = 'Bible for Spiritual enrichment for life';
                invoices[1].reason = 'Cloud server to serve up work blog for PD purposes to raise money';
                invoices[2].reason = 'Pens and staples for writing cards and to staple documents for organization';
                let newInvoice = new models.Invoice();
                newInvoice.category = 400;
                newInvoice.purchaseDate = new Date('2019-8-13');
                newInvoice.reason = 'Bible to feed my soul to live in eternity';
                newInvoice.total = 6599;
                newInvoice.doc = 'example.com/daniel/image5.jpg';
                newInvoice.agent = agent._id;
                invoices.push(newInvoice);


                const saveInvoices = function() {
                  if (!invoices.length) {
                    return request(app)
                      .get(`/image/${agent.getAgentDirectory()}/zip`)
                      .set('Cookie', browser.cookies)
                      .expect(200)
                      .expect( 'Content-Type', /application\/zip/ )
                      .parse(binaryParser)
                      .end(function(err, res) {
                        if (err) done.fail(err);

                        expect(Buffer.isBuffer(res.body)).toBe(true);

                        let zip = new AdmZip(res.body);
                        zipEntries = zip.getEntries();

                        // One file in zipEntries is the CSV and another the ODS (not to be counted in the image count)
                        expect(res.header['content-disposition']).toMatch(`${agent.getBaseFilename()} #1-${zipEntries.length-2}.zip`);

                        done();
                      });
                  }
                  let invoice = invoices.pop();
                  invoice.save().then(result => {
                    saveInvoices();
                  }).catch(err => {
                    return done.fail(err);
                  });

                };
                saveInvoices();
              }).catch(function(err) {
                done.fail(err);
              });
            });

            it('splits item/reason on for/to', done => {
              models.Invoice.find({agent: agent._id}).sort({ purchaseDate: -1 }).then(invoices => {
                expect(invoices.length).toEqual(4);
                let csv = zipEntries[0].getData().toString('utf8')
                csv = csv.split('\n');
                expect(csv[0]).toEqual('"Category","Purchase Date","Item","Business Purpose of Expense","Receipt ref #","Local Amount","Currency Used","Exchange Rate"');
                expect(csv[1]).toEqual('"430","10 Aug \'19","Pens and staples","Writing cards and to staple documents for organization",1,"9.65","CAD",1');
                expect(csv[2]).toEqual('"440","11 Aug \'19","Cloud server","Serve up work blog for PD purposes to raise money",2,"17.30","USD",1.35');
                expect(csv[3]).toEqual('"400","12 Aug \'19","Bible","Spiritual enrichment for life",3,"65.99","CAD",1');
                expect(csv[4]).toEqual('"400","13 Aug \'19","Bible","Feed my soul to live in eternity",4,"65.99","CAD",1');
                done();
              }).catch(function(err) {
                done.fail(err);
              });
            });

            it('doesn\'t barf on one-word reasons', done => {
              models.Invoice.findOneAndUpdate({ doc: `uploads/${agent.getAgentDirectory()}/image5.jpg` }, { reason: 'oneword' }, {useFindAndModify: false}).then(invoice => {
                browser.visit('/image', err => {
                  if (err) return done.fail(err);
                  browser.clickLink('#zip-link', err => {
                    if (err) return done.fail(err);
                    browser.assert.success();
                    done();
                  });
                });
              }).catch(function(err) {
                done.fail(err);
              });
            });
          });

          describe('custom spreadsheet generation', () => {
            beforeEach(done => {
              mock.restore();
              mockAndUnmock({
                [`uploads/${agent.getAgentDirectory()}`]: {
                  'image1.jpg': fs.readFileSync('spec/files/troll.jpg'),
                  'image2.pdf': fs.readFileSync('spec/files/troll.jpg'),
                  'image3.GiF': fs.readFileSync('spec/files/troll.jpg'),
                  'image4': fs.readFileSync('spec/files/troll.jpg'),
                  'image5.jpg': fs.readFileSync('spec/files/troll.jpg'),
                  'templates': { 'MER-template.xlsx': fs.readFileSync('spec/files/MER-template.xlsx') },
                },
                'public/templates/': {},  // <-------- No default template!
              });
              done();
            });

            it('does not list the agent\'s templates/ directory in the photo roll', done => {
              browser.visit(`/image/${agent.getAgentDirectory()}`, err => {
                if (err) return done.fail(err);
                browser.assert.success();
                browser.assert.elements('section.image img', 3);
                browser.assert.elements('section.link', 2);
                done();
              });
            });

          /**
           * `child_process.spawn` does not access the mocked file system
           * These tests are useless
           */
//            it('generates the spreadsheet from the agent\'s templates/ directory', done => {
//              function binaryParser(res, callback) {
//                res.setEncoding('binary');
//                res.data = '';
//                res.on('data', function (chunk) {
//                  res.data += chunk;
//                });
//                res.on('end', function () {
//                  callback(null, Buffer.from(res.data, 'binary'));
//                });
//              }
//
//              request(app)
//                .get(`/image/${agent.getAgentDirectory()}/zip`)
//                .set('Cookie', browser.cookies)
//                .expect(200)
//                .expect( 'Content-Type', /application\/zip/ )
//                .parse(binaryParser)
//                .end(function(err, res) {
//                  if (err) done.fail(err);
//
//                  expect(Buffer.isBuffer(res.body)).toBe(true);
//
//                  let zip = new AdmZip(res.body);
//                  zipEntries = zip.getEntries();
//
//                  // One file in zipEntries is the CSV and the other and ODS (not to be counted in the image count)
//                  expect(res.header['content-disposition']).toMatch(`${agent.getBaseFilename()} #1-${zipEntries.length-2}.zip`);
//
//                  expect(zipEntries.length).toEqual(5);
//                  expect(zipEntries[0].name).toEqual(`${agent.name.split(' ').pop()} MER.csv`);
//                  expect(zipEntries[1].name).toEqual(`${agent.name.split(' ').pop()} MER.xlsx`);
//                  expect(zipEntries[2].name).toEqual(`${agent.getBaseFilename()} #1.pdf`);
//                  expect(zipEntries[3].name).toEqual(`${agent.getBaseFilename()} #2`);
//                  expect(zipEntries[4].name).toEqual(`${agent.getBaseFilename()} #3.jpg`);
//
//                  done();
//                });
//            });
          });
      });
    });

      describe('writer agent', () => {
        beforeEach(done => {
          models.Invoice.find().then(invoices => {
            for (let invoice of invoices) {
              invoice.agent = troy._id;
              invoice.doc = invoice.doc.replace('daniel', 'troy');
              invoice.doc = invoice.doc.replace('image', 'troy');
              invoice._id = undefined;
            }

            models.Invoice.insertMany(invoices, (err, num) => {
              if (err) return done.fail(err);

              browser.visit(`/image/${troy.getAgentDirectory()}`, function(err) {
                if (err) return done.fail(err);
                browser.assert.success();
                done();
              });
            });
          }).catch(function(err) {
            done.fail(err);
          });
        });

        it('displays a link to zip and download the images if viewing an album to which the agent may write', () => {
          browser.assert.url({ pathname: `/image/${troy.getAgentDirectory()}`});
          browser.assert.element(`a[href="/image/${troy.getAgentDirectory()}/zip"]`);
        });

        it('does not display a link to zip and download the images if there are no images', (done) => {
          mock.restore();
          browser.visit(`/image/${troy.getAgentDirectory()}`, function(err) {
            if (err) return done.fail(err);
            browser.assert.success();
            browser.assert.elements('section.image img', 0);
            browser.assert.elements('section.link a', 0);
            browser.assert.elements(`a[href="/image/${troy.getAgentDirectory()}/zip"]`, 0);
            done();
          });
        });

        it('does not display a link to zip and download the images if none have been processed as invoices', (done) => {
          models.mongoose.connection.db.dropCollection('invoices').then(result => {
            browser.visit(`/image/${troy.getAgentDirectory()}`, function(err) {
              if (err) return done.fail(err);
              browser.assert.success();
              browser.assert.elements('section.image img', 3);
              browser.assert.elements('section.link a', 2);
              browser.assert.elements(`a[href="/image/${troy.getAgentDirectory()}/zip"]`, 0);
              done();
            });
          }).catch(function(err) {
            done.fail(err);
          });
        });

        describe('zipping contents', () => {

          describe('with no processed invoices', () => {
            it('returns an appropriate message if no images have been uploaded', (done) => {
              mock.restore();
              browser.clickLink('#zip-link', function(err) {
                if (err) done.fail(err);
                browser.assert.redirected();
                browser.assert.url({ pathname: `/image/${troy.getAgentDirectory()}` });
                browser.assert.text('.alert.alert-danger', 'You have no processed invoices');
                done();
              });
            });

            it('returns an appropriate message if no images have been processed as receipts', (done) => {
              models.mongoose.connection.db.dropCollection('invoices').then(result => {
                browser.clickLink('#zip-link', function(err) {
                  if (err) done.fail(err);
                  browser.assert.redirected();
                  browser.assert.url({ pathname: `/image/${troy.getAgentDirectory()}` });
                  browser.assert.text('.alert.alert-danger', 'You have no processed invoices');
                  done();
                });
              }).catch(function(err) {
                done.fail(err);
              });
            });
          });

          describe('with processed invoices', () => {
            let zipEntries;
            beforeEach(done => {
              request(app)
                .get(`/image/${troy.getAgentDirectory()}/zip`)
                .set('Cookie', browser.cookies)
                .expect(200)
                .expect( 'Content-Type', /application\/zip/ )
                .parse(binaryParser)
                .end(function(err, res) {
                  if (err) done.fail(err);

                  expect(Buffer.isBuffer(res.body)).toBe(true);

                  let zip = new AdmZip(res.body);
                  zipEntries = zip.getEntries();

                  // One file in zipEntries is the CSV and the other an ODS (not to be counted in the image count)
                  expect(res.header['content-disposition']).toMatch(`${troy.getBaseFilename()} #1-${zipEntries.length-2}.zip`);

                  done();
                });
            });

            // The `gif` has no associated invoice (cf., `fixtures/invoices.js`)
            it('compresses the image directory and returns a zip file containing images processed as receipts', () => {
              expect(zipEntries.length).toEqual(5);
              expect(zipEntries[0].name).toEqual(`${troy._doc.name.split(' ').pop()} MER.csv`);
              expect(zipEntries[1].name).toEqual(`${troy._doc.name.split(' ').pop()} MER.xlsx`);
              expect(zipEntries[2].name).toEqual(`${troy.getBaseFilename()} #1.pdf`);
              expect(zipEntries[3].name).toEqual(`${troy.getBaseFilename()} #2`);
              expect(zipEntries[4].name).toEqual(`${troy.getBaseFilename()} #3.jpg`);
            });

            it('consolidates the invoice data in a CSV', done => {
              models.Invoice.find({agent: troy._id}).sort({ purchaseDate: -1 }).then(invoices => {
                expect(invoices.length).toEqual(3);
                let csv = zipEntries[0].getData().toString('utf8')
                csv = csv.split('\n');
                expect(csv[0]).toEqual('"Category","Purchase Date","Item","Business Purpose of Expense","Receipt ref #","Local Amount","Currency Used","Exchange Rate"');
                expect(csv[1]).toEqual('"430","10 Aug \'19","Pens and staples","Supplies and Stationery",1,"9.65","CAD",1');
                expect(csv[2]).toEqual('"440","11 Aug \'19","Cloud server","Communication (Phone, Fax, E-mail)",2,"17.30","USD",1.35');
                expect(csv[3]).toEqual('"400","12 Aug \'19","Bible","Equipment",3,"65.99","CAD",1');
                done();
              }).catch(function(err) {
                done.fail(err);
              });
            });

            it('ignores archived files when zipping', done => {
              browser.pressButton('#archive-button', function(err) {
                if (err) done.fail(err);
                browser.assert.success();
                fs.writeFileSync(`uploads/${troy.getAgentDirectory()}/troy6.jpg`, fs.readFileSync('spec/files/troll.jpg'));

                let newInvoice = new models.Invoice();
                newInvoice.category = 400;
                newInvoice.purchaseDate = new Date('2019-8-13');
                newInvoice.reason = 'Bible to feed my soul to live in eternity';
                newInvoice.total = 6599;
                newInvoice.doc = 'example.com/troy/troy6.jpg';
                newInvoice.agent = troy._id;

                newInvoice.save().then(result => {
                  request(app)
                    .get(`/image/${troy.getAgentDirectory()}/zip`)
                    .set('Cookie', browser.cookies)
                    .expect(200)
                    .expect( 'Content-Type', /application\/zip/ )
                    .parse(binaryParser)
                    .end(function(err, res) {
                      if (err) done.fail(err);

                      expect(Buffer.isBuffer(res.body)).toBe(true);

                      let zip = new AdmZip(res.body);
                      zipEntries = zip.getEntries();

                      // One file in zipEntries is the CSV and the other is an ODS (not to be counted in the image count)
                      expect(res.header['content-disposition']).toMatch(`${troy.getBaseFilename()} #1-${zipEntries.length-2}.zip`);
                      expect(zipEntries.length).toEqual(3);
                      expect(zipEntries[0].name).toEqual(`${troy._doc.name.split(' ').pop()} MER.csv`);
                      expect(zipEntries[1].name).toEqual(`${troy._doc.name.split(' ').pop()} MER.xlsx`);
                      expect(zipEntries[2].name).toEqual(`${troy.getBaseFilename()} #1.jpg`);

                      done();
                    });
                }).catch(err => {
                  done.fail(err);
                });
              });
            });
          });

          describe('with for/to regex-aware business purposes', () => {
            let zipEntries;
            beforeEach(done => {
              models.Invoice.find({agent: troy._id}).sort({ purchaseDate: -1 }).then(invoices => {
                expect(invoices.length).toEqual(3);
                invoices[0].reason = 'Bible for Spiritual enrichment for life';
                invoices[1].reason = 'Cloud server to serve up work blog for PD purposes to raise money';
                invoices[2].reason = 'Pens and staples for writing cards and to staple documents for organization';
                let newInvoice = new models.Invoice();
                newInvoice.category = 400;
                newInvoice.purchaseDate = new Date('2019-8-13');
                newInvoice.reason = 'Bible to feed my soul to live in eternity';
                newInvoice.total = 6599;
                newInvoice.doc = 'example.com/troy/troy5.jpg';
                newInvoice.agent = troy._id;
                invoices.push(newInvoice);

                const saveInvoices = function() {
                  if (!invoices.length) {
                    return request(app)
                      .get(`/image/${troy.getAgentDirectory()}/zip`)
                      .set('Cookie', browser.cookies)
                      .expect(200)
                      .expect( 'Content-Type', /application\/zip/ )
                      .parse(binaryParser)
                      .end(function(err, res) {
                        if (err) done.fail(err);

                        expect(Buffer.isBuffer(res.body)).toBe(true);

                        let zip = new AdmZip(res.body);
                        zipEntries = zip.getEntries();

                        // One file in zipEntries is the CSV and the other an ODS (not to be counted in the image count)
                        expect(res.header['content-disposition']).toMatch(`${troy.getBaseFilename()} #1-${zipEntries.length-2}.zip`);

                        done();
                      });
                  }
                  let invoice = invoices.pop();
                  invoice.save().then(result => {
                    saveInvoices();
                  }).catch(err => {
                    return done.fail(err);
                  });

                };
                saveInvoices();
              }).catch(function(err) {
                done.fail(err);
              });
            });

            it('splits item/reason on for/to', done => {
              models.Invoice.find({agent: troy._id}).sort({ purchaseDate: -1 }).then(invoices => {
                expect(invoices.length).toEqual(4);
                let csv = zipEntries[0].getData().toString('utf8')
                csv = csv.split('\n');
                expect(csv[0]).toEqual('"Category","Purchase Date","Item","Business Purpose of Expense","Receipt ref #","Local Amount","Currency Used","Exchange Rate"');
                expect(csv[1]).toEqual('"430","10 Aug \'19","Pens and staples","Writing cards and to staple documents for organization",1,"9.65","CAD",1');
                expect(csv[2]).toEqual('"440","11 Aug \'19","Cloud server","Serve up work blog for PD purposes to raise money",2,"17.30","USD",1.35');
                expect(csv[3]).toEqual('"400","12 Aug \'19","Bible","Spiritual enrichment for life",3,"65.99","CAD",1');
                expect(csv[4]).toEqual('"400","13 Aug \'19","Bible","Feed my soul to live in eternity",4,"65.99","CAD",1');
                done();
              }).catch(function(err) {
                done.fail(err);
              });
            });

            it('doesn\'t barf on one-word reasons', done => {
              models.Invoice.findOneAndUpdate({ doc: `uploads/${troy.getAgentDirectory()}/troy5.jpg` }, { reason: 'oneword' }, {useFindAndModify: false}).then(invoice => {
                browser.visit('/image', err => {
                  if (err) return done.fail(err);
                  browser.clickLink('#zip-link', err => {
                    if (err) return done.fail(err);
                    browser.assert.success();
                    done();
                  });
                });
              }).catch(function(err) {
                done.fail(err);
              });
            });
          });

          describe('custom spreadsheet generation', () => {
            beforeEach(done => {
              mock.restore();
              mockAndUnmock({
                [`uploads/${troy.getAgentDirectory()}`]: {
                  'troy1.jpg': fs.readFileSync('spec/files/troll.jpg'),
                  'troy2.pdf': fs.readFileSync('spec/files/troll.jpg'),
                  'troy3.GiF': fs.readFileSync('spec/files/troll.jpg'),
                  'troy4': fs.readFileSync('spec/files/troll.jpg'),
                  'troy5.jpg': fs.readFileSync('spec/files/troll.jpg'),
                  'templates': { 'MER-template.xlsx': fs.readFileSync('spec/files/MER-template.xlsx') },
                },
                'public/templates': {},  // <-------- No default template!
              });
              done();
            });

            it('does not list the agent\'s templates/ directory in the photo roll', done => {
              browser.visit(`/image/${troy.getAgentDirectory()}`, err => {
                if (err) return done.fail(err);
                browser.assert.success();
                browser.assert.elements('section.image img', 3);
                browser.assert.elements('section.link', 2);
                done();
              });
            });

          /**
           * `child_process.spawn` does not access the mocked file system
           * These tests are useless
           */
//            it('generates the spreadsheet from the agent\'s templates/ directory', done => {
//              function binaryParser(res, callback) {
//                res.setEncoding('binary');
//                res.data = '';
//                res.on('data', function (chunk) {
//                  res.data += chunk;
//                });
//                res.on('end', function () {
//                  callback(null, Buffer.from(res.data, 'binary'));
//                });
//              }
//
//              request(app)
//                .get(`/image/${troy.getAgentDirectory()}/zip`)
//                .set('Cookie', browser.cookies)
//                .expect(200)
//                .expect( 'Content-Type', /application\/zip/ )
//                .parse(binaryParser)
//                .end(function(err, res) {
//                  if (err) done.fail(err);
//
//                  expect(Buffer.isBuffer(res.body)).toBe(true);
//
//                  let zip = new AdmZip(res.body);
//                  zipEntries = zip.getEntries();
//
//                  // One file in zipEntries is the CSV and the other an ODS (not to be counted in the image count)
//                  expect(res.header['content-disposition']).toMatch(`${troy.getBaseFilename()} #1-${zipEntries.length-2}.zip`);
//
//                  expect(zipEntries.length).toEqual(5);
//                  expect(zipEntries[0].name).toEqual(`${troy.name.split(' ').pop()} MER.csv`);
//                  expect(zipEntries[1].name).toEqual(`${troy.name.split(' ').pop()} MER.xlsx`);
//                  expect(zipEntries[2].name).toEqual(`${troy.getBaseFilename()} #1.pdf`);
//                  expect(zipEntries[3].name).toEqual(`${troy.getBaseFilename()} #2`);
//                  expect(zipEntries[4].name).toEqual(`${troy.getBaseFilename()} #3.jpg`);
//
//                  done();
//                });
//            });
          });
        });
      });
    });

    describe('unauthorized', () => {
      it('does not display a zip link in an album the agent can read but does not own', done => {
        expect(agent.canRead.length).toEqual(1);
        expect(agent.canRead[0]).toEqual(lanny._id);

        browser.visit(`/image/${lanny.getAgentDirectory()}`, function(err) {
          if (err) return done.fail(err);
          browser.assert.success();
          browser.assert.elements(`a[href="/image/${agent.getAgentDirectory()}/zip"]`, 0);
          done();
        });
      });

      it('does not return a zip file', done => {
        request(app)
          .get(`/image/${lanny.getAgentDirectory()}/zip`)
          .set('Cookie', browser.cookies)
          .expect(403)
          .end(function(err, res) {
            if (err) done.fail(err);
            done();
          });
      });
    });
  });

  describe('unauthenticated', () => {
    it('redirects home (which is where the login form is located)', done => {
      browser.visit(`/image/${agent.getAgentDirectory()}/zip`, function(err) {
        if (err) return done.fail(err);
        browser.assert.redirected();
        browser.assert.url({ pathname: '/'});
        browser.assert.text('.alert.alert-danger', 'You need to login first');
        done();
      });
    });

    // This is getting caught by basic auth and redirecting to home
    it('does not return a zip file', done => {
      request(app)
        .get(`/image/${agent.getAgentDirectory()}/zip`)
        .expect(302)
        .end(function(err, res) {
          if (err) done.fail(err);

          expect(res.header.location).toEqual('/');
          done();
        });
    });
  });
});
