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

describe('DELETE /image/:domain/:agentId/:imageId', function() {

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
    it('does not allow deleting an image', function(done) {
      request(app)
        .delete(`/image/${agent.getAgentDirectory()}/image2.jpg`)
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
          'image2.jpg': fs.readFileSync('spec/files/troll.jpg'),
          'image3.jpg': fs.readFileSync('spec/files/troll.jpg'),
        },
        [`uploads/${lanny.getAgentDirectory()}`]: {
          'lanny1.jpg': fs.readFileSync('spec/files/troll.jpg'),
          'lanny2.jpg': fs.readFileSync('spec/files/troll.jpg'),
          'lanny3.jpg': fs.readFileSync('spec/files/troll.jpg'),
        },
        [`uploads/${troy.getAgentDirectory()}`]: {
          'troy1.jpg': fs.readFileSync('spec/files/troll.jpg'),
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

    it('renders a form to allow an agent to delete an image', function(done) {
      browser.clickLink(`a[href="/image/${agent.getAgentDirectory()}/image1.jpg"]`, (err) => {
        if (err) return done.fail(err);
        browser.assert.success();
        browser.assert.element('#delete-image-form');
        browser.assert.element(`form[action="/image/${agent.getAgentDirectory()}/image1.jpg?_method=DELETE"]`);
        done();
      });
    });

    describe('deleting', function() {
      describe('owner resource', function() {
        beforeEach(function(done) {
          browser.clickLink(`a[href="/image/${agent.getAgentDirectory()}/image1.jpg"]`, (err) => {
            if (err) return done.fail(err);
            browser.assert.success();
            done();
          });
        });
  
        describe('with no associated invoice', () => {
          it('redirects to the origin album if the delete is successful', function(done) {
            browser.pressButton('Delete', function(err) {
              if (err) return done.fail(err);
    
              browser.assert.success();
              browser.assert.text('.alert.alert-info', 'Image deleted');
              browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}` });
              done();
            });
          });
    
          it('deletes the image from the file system', function(done) {
            fs.readdir(`uploads/${agent.getAgentDirectory()}`, (err, files) => {
              if (err) return done.fail(err);
              expect(files.length).toEqual(3);
              expect(files.includes('image1.jpg')).toBe(true);
    
              browser.pressButton('Delete', function(err) {
                if (err) return done.fail(err);
                browser.assert.success();
    
                fs.readdir(`uploads/${agent.getAgentDirectory()}`, (err, files) => {
                  if (err) return done.fail(err);
                  expect(files.length).toEqual(2);
                  expect(files.includes('image1.jpg')).toBe(false);
        
                  done();
                });
              });
            });
          });
        });

        describe('with associated invoice', () => {
          let invoice;
          beforeEach(done => {
            models.Invoice.create({
              category: 110,
              purchaseDate: new Date('2019-09-02'),
              reason: 'Thank supporters',
              doc: `${agent.getAgentDirectory()}/image1.jpg`,
              total: '12.69',
              agent: agent._id,
            }).then((results) => {
              invoice = results;
              done()
            }).catch(error => {
              done.fail(error);
            });
          });

          it('redirects to the origin album if the delete is successful', function(done) {
            browser.pressButton('Delete', function(err) {
              if (err) return done.fail(err);
    
              browser.assert.success();
              browser.assert.text('.alert.alert-info', 'Image deleted');
              browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}` });
              done();
            });
          });

          it('deletes the image from the file system', function(done) {
            fs.readdir(`uploads/${agent.getAgentDirectory()}`, (err, files) => {
              if (err) return done.fail(err);
              expect(files.length).toEqual(3);
              expect(files.includes('image1.jpg')).toBe(true);
    
              browser.pressButton('Delete', function(err) {
                if (err) return done.fail(err);
                browser.assert.success();
    
                fs.readdir(`uploads/${agent.getAgentDirectory()}`, (err, files) => {
                  if (err) return done.fail(err);
                  expect(files.length).toEqual(2);
                  expect(files.includes('image1.jpg')).toBe(false);
        
                  done();
                });
              });
            });
          });

          it('deletes the invoice from the database', function(done) {
            models.Invoice.find({}).then((invoices) => {
              expect(invoices.length).toEqual(1);

              browser.pressButton('Delete', function(err) {
                if (err) return done.fail(err);
                browser.assert.success();
                models.Invoice.find({}).then((invoices) => {
                  expect(invoices.length).toEqual(0);
                  done();
                }).catch(error => {
                  done.fail(error);
                });
              });
            }).catch(error => {
              done.fail(error);
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

        it('does not show a delete button', () => {
          browser.assert.elements('#delete-image-form', 0);
        });

        it('does not delete the image from the file system', function(done) {
          fs.readdir(`uploads/${lanny.getAgentDirectory()}`, (err, files) => {
            if (err) return done.fail(err);
            expect(files.length).toEqual(3);
            expect(files.includes('lanny1.jpg')).toBe(true);

            request(app)
              .delete(`/image/${lanny.getAgentDirectory()}/lanny1.jpg`)
              .set('Cookie', browser.cookies)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.status).toEqual(302);
                expect(res.header.location).toEqual(`/image/${lanny.getAgentDirectory()}`);

                fs.readdir(`uploads/${lanny.getAgentDirectory()}`, (err, files) => {
                  if (err) return done.fail(err);
                  expect(files.length).toEqual(3);
                  expect(files.includes('lanny1.jpg')).toBe(true);

                  done();
                });
              });
          });
        });

        describe('associated invoice', () => {
          let invoice;
          beforeEach(done => {
            models.Invoice.create({
              category: 110,
              purchaseDate: new Date('2019-09-02'),
              reason: 'Thank supporters',
              doc: `${lanny.getAgentDirectory()}/lanny1.jpg`,
              total: '12.69',
              agent: lanny._id,
            }).then((results) => {
              invoice = results;
              done()
            }).catch(error => {
              done.fail(error);
            });
          });       

          it('does not delete the invoice from the database', function(done) {
            models.Invoice.find({}).then((invoices) => {
              expect(invoices.length).toEqual(1);
  
              request(app)
                .delete(`/image/${lanny.getAgentDirectory()}/lanny1.jpg`)
                .set('Cookie', browser.cookies)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(res.status).toEqual(302);
                  expect(res.header.location).toEqual(`/image/${lanny.getAgentDirectory()}`);
  
                  models.Invoice.find({}).then((invoices) => {
                    expect(invoices.length).toEqual(1);
                    done();
                  }).catch(error => {
                    done.fail(error);
                  });
                });
            }).catch(error => {
              done.fail(error);
            });
          });
        });
      });

      describe('unauthorized resource', function() {
        beforeEach(function(done) {
          agent.canWrite.pop();
          agent.save().then(result => {
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
        });

        it('redirects home', () => {
          browser.assert.redirected();
          browser.assert.url({ pathname: '/'});
          browser.assert.text('.alert.alert-danger', 'You are not authorized to access that resource');
        });

        it('does not delete the image from the file system', function(done) {
          mkdirp(`uploads/${troy.getAgentDirectory()}`, (err) => {
            fs.writeFileSync(`uploads/${troy.getAgentDirectory()}/troy1.jpg`, fs.readFileSync('spec/files/troll.jpg'));

            fs.readdir(`uploads/${troy.getAgentDirectory()}`, (err, files) => {
              if (err) return done.fail(err);
              expect(files.length).toEqual(1);
              expect(files.includes('troy1.jpg')).toBe(true);
  
              request(app)
                .delete(`/image/${troy.getAgentDirectory()}/troy1.jpg`)
                .set('Cookie', browser.cookies)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(res.status).toEqual(302);
                  expect(res.header.location).toEqual('/');
  
                  fs.readdir(`uploads/${troy.getAgentDirectory()}`, (err, files) => {
                    if (err) return done.fail(err);
                    expect(files.length).toEqual(1);
                    expect(files.includes('troy1.jpg')).toBe(true);
  
                    done();
                  });
                });
            });
          });
        });

        describe('associated invoice', () => {
          let invoice;
          beforeEach(done => {
            models.Invoice.create({
              category: 110,
              purchaseDate: new Date('2019-09-02'),
              reason: 'Thank supporters',
              doc: `${troy.getAgentDirectory()}/troy.jpg`,
              total: '12.69',
              agent: troy._id,
            }).then((results) => {
              invoice = results;
              done()
            }).catch(error => {
              done.fail(error);
            });
          });

          it('does not delete the invoice from the database', function(done) {
            models.Invoice.find({}).then((invoices) => {
              expect(invoices.length).toEqual(1);
  
              request(app)
                .delete(`/image/${troy.getAgentDirectory()}/troy.jpg`)
                .set('Cookie', browser.cookies)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(res.status).toEqual(302);
                  expect(res.header.location).toEqual(`/`);
  
                  models.Invoice.find({}).then((invoices) => {
                    expect(invoices.length).toEqual(1);
                    done();
                  }).catch(error => {
                    done.fail(error);
                  });
                });
            }).catch(error => {
              done.fail(error);
            });
          });
        });
      });

      describe('writable resource', function() {
        beforeEach(function(done) {
          browser.visit(`/image/${troy.getAgentDirectory()}/troy1.jpg`, function(err) {
            if (err) return done.fail(err);
            done();
          });
        });

        describe('with no associated invoice', () => {
          it('redirects to the origin album if the delete is successful', function(done) {
            browser.pressButton('Delete', function(err) {
              if (err) return done.fail(err);

              browser.assert.success();
              browser.assert.text('.alert.alert-info', 'Image deleted');
              browser.assert.url({ pathname: `/image/${troy.getAgentDirectory()}` });
              done();
            });
          });

          it('deletes the image from the file system', function(done) {
            fs.readdir(`uploads/${troy.getAgentDirectory()}`, (err, files) => {
              if (err) return done.fail(err);
              expect(files.length).toEqual(1);
              expect(files.includes('troy1.jpg')).toBe(true);

              browser.pressButton('Delete', function(err) {
                if (err) return done.fail(err);
                browser.assert.success();

                fs.readdir(`uploads/${troy.getAgentDirectory()}`, (err, files) => {
                  if (err) return done.fail(err);
                  expect(files.length).toEqual(0);
                  expect(files.includes('troy1.jpg')).toBe(false);

                  done();
                });
              });
            });
          });
        });

        describe('with associated invoice', () => {
          let invoice;
          beforeEach(done => {
            models.Invoice.create({
              category: 110,
              purchaseDate: new Date('2019-09-02'),
              reason: 'Thank supporters',
              doc: `${troy.getAgentDirectory()}/troy1.jpg`,
              total: '12.69',
              agent: troy._id,
            }).then((results) => {
              invoice = results;
              done()
            }).catch(error => {
              done.fail(error);
            });
          });

          it('redirects to the origin album if the delete is successful', function(done) {
            browser.pressButton('Delete', function(err) {
              if (err) return done.fail(err);

              browser.assert.success();
              browser.assert.text('.alert.alert-info', 'Image deleted');
              browser.assert.url({ pathname: `/image/${troy.getAgentDirectory()}` });
              done();
            });
          });

          it('deletes the image from the file system', function(done) {
            fs.readdir(`uploads/${troy.getAgentDirectory()}`, (err, files) => {
              if (err) return done.fail(err);
              expect(files.length).toEqual(1);
              expect(files.includes('troy1.jpg')).toBe(true);

              browser.pressButton('Delete', function(err) {
                if (err) return done.fail(err);
                browser.assert.success();

                fs.readdir(`uploads/${troy.getAgentDirectory()}`, (err, files) => {
                  if (err) return done.fail(err);
                  expect(files.length).toEqual(0);
                  expect(files.includes('troy1.jpg')).toBe(false);

                  done();
                });
              });
            });
          });

          it('deletes the invoice from the database', function(done) {
            models.Invoice.find({}).then((invoices) => {
              expect(invoices.length).toEqual(1);

              browser.pressButton('Delete', function(err) {
                if (err) return done.fail(err);
                browser.assert.success();
                models.Invoice.find({}).then((invoices) => {
                  expect(invoices.length).toEqual(0);
                  done();
                }).catch(error => {
                  done.fail(error);
                });
              });
            }).catch(error => {
              done.fail(error);
            });
          });
        });
      });
    });
  });
});
