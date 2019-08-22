const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
Browser.localhost('example.com', PORT);
const fs = require('fs');
const app = require('../../app');
const fixtures = require('pow-mongoose-fixtures');
const models = require('../../models'); 
const jwt = require('jsonwebtoken');
const request = require('supertest');

/**
 * `mock-fs` stubs the entire file system. So if a module hasn't
 * already been `require`d the tests will fail because the 
 * module doesn't exist in the mocked file system. `ejs` and
 * `iconv-lite/encodings` are required here to solve that 
 * problem.
 */
const mock = require('mock-fs');
const mockAndUnmock = require('../support/mockAndUnmock')(mock);

describe('imageArchiveSpec', () => {
  let browser, agent, lanny, troy;

  beforeEach(function(done) {
    browser = new Browser({ waitDuration: '30s', loadCss: false });
    //browser.debug();
    fixtures.load(__dirname + '/../fixtures/agents.js', models.mongoose, function(err) {
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

  afterEach(function(done) {
    models.mongoose.connection.db.dropDatabase().then((result) => {
      done();
    }).catch(function(err) {
      done.fail(err);
    });
  });

  describe('authenticated', () => {
    beforeEach(done => {
      fixtures.load(__dirname + '/../fixtures/invoices.js', models.mongoose, function(err) {
        if (err) return done.fail(err);
        mockAndUnmock({ 
          [`uploads/${agent.getAgentDirectory()}`]: {
            'image1.jpg': fs.readFileSync('spec/files/troll.jpg'),
            'image2.pdf': fs.readFileSync('spec/files/troll.jpg'),
            'image3.GiF': fs.readFileSync('spec/files/troll.jpg'),
            'image4': fs.readFileSync('spec/files/troll.jpg'),
          },
          [`uploads/${lanny.getAgentDirectory()}`]: {
            'lanny1.jpg': fs.readFileSync('spec/files/troll.jpg'),
            'lanny2.jpg': fs.readFileSync('spec/files/troll.jpg'),
            'lanny3.jpg': fs.readFileSync('spec/files/troll.jpg'),
          },
          [`uploads/${troy.getAgentDirectory()}`]: {
            'troy1.jpg': fs.readFileSync('spec/files/troll.jpg'),
            'troy2.jpg': fs.readFileSync('spec/files/troll.jpg'),
            'troy3.doc': fs.readFileSync('spec/files/troll.jpg'),
          },
          'public/images/uploads': {}
        });

        spyOn(jwt, 'sign').and.returnValue('somejwtstring');

        browser.fill('email', agent.email);
        browser.fill('password', 'secret');
        browser.pressButton('Login', function(err) {
          if (err) done.fail(err);
          browser.assert.success();
          done();
        });
      });
    });

    afterEach(done => {
      models.mongoose.connection.db.dropDatabase().then(result => {
        mock.restore();
        done();
      }).catch(function(err) {
        done.fail(err);
      });
    });

    describe('authorized', () => {
      describe('agent viewing own album\'s interface', () => {
        it('displays a form to archive the images if viewing his own album', () => {
          browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}`});
          browser.assert.element(`form[action='/image/${agent.getAgentDirectory()}/archive']`);
        });

        it('does not display a form to archive the images if there are no images', (done) => {
          mock.restore();
          browser.visit(`/image/${agent.getAgentDirectory()}`, function(err) {
            if (err) return done.fail(err);
            browser.assert.success();
            browser.assert.elements('section.image img', 0);
            browser.assert.elements('section.link a', 0);
            browser.assert.elements(`form[action='/image/${agent.getAgentDirectory()}/archive']`, 0);
            done();
          });
        });

        it('displays a link to archive the images even if none have been processed as invoices', (done) => {
          models.mongoose.connection.db.dropCollection('invoices').then(result => {
            browser.visit(`/image/${agent.getAgentDirectory()}`, function(err) {
              if (err) return done.fail(err);
              browser.assert.success();
              browser.assert.elements('section.image img', 2);
              browser.assert.elements('section.link a', 2);
              browser.assert.element(`form[action='/image/${agent.getAgentDirectory()}/archive']`);
              done();
            });
          }).catch(function(err) {
            done.fail(err);
          });
        });
      });

      describe('agent viewing a writable album\'s interface', () => {
        beforeEach(done => {
          browser.visit(`/image/${troy.getAgentDirectory()}`, err => {
            if (err) return done.fail(err);
            browser.assert.success();
            done();
          });
        });

        it('displays a form to archive the images if viewing a writable album', () => {
          browser.assert.url({ pathname: `/image/${troy.getAgentDirectory()}`});
          browser.assert.element(`form[action='/image/${troy.getAgentDirectory()}/archive']`);
        });

        it('does not display a form to archive the images if there are no images', (done) => {
          mock.restore();
          browser.visit(`/image/${troy.getAgentDirectory()}`, function(err) {
            if (err) return done.fail(err);
            browser.assert.url({ pathname: `/image/${troy.getAgentDirectory()}`});
            browser.assert.success();
            browser.assert.elements('section.image img', 0);
            browser.assert.elements('section.link a', 0);
            browser.assert.elements(`form[action='/image/${troy.getAgentDirectory()}/archive']`, 0);
            done();
          });
        });

        it('displays a link to archive the images even if none have been processed as invoices', (done) => {
          models.mongoose.connection.db.dropCollection('invoices').then(result => {
            browser.visit(`/image/${troy.getAgentDirectory()}`, function(err) {
              if (err) return done.fail(err);
              browser.assert.success();
              browser.assert.url({ pathname: `/image/${troy.getAgentDirectory()}`});
              browser.assert.elements('section.image img', 2);
              browser.assert.elements('section.link a', 1);
              browser.assert.element(`form[action='/image/${troy.getAgentDirectory()}/archive']`);
              done();
            });
          }).catch(function(err) {
            done.fail(err);
          });
        });
      });

      describe('archiving contents', () => {

        describe('with no invoices', () => {
          it('returns an appropriate message if no images have been uploaded to agent\'s album', (done) => {
            mock.restore();
            request(app)
              .post(`/image/${agent.getAgentDirectory()}/archive`)
              .set('Cookie', browser.cookies)
              .expect(404)
              .expect('Content-Type', /application\/json/ )
              .end(function(err, res) {
                if (err) done.fail(err);
                expect(res.body).toEqual({message: 'You have no invoices to archive'});
                done();
              });
          });

          it('returns an appropriate message if no images have been uploaded to a writable album', (done) => {
            mock.restore();
            request(app)
              .post(`/image/${troy.getAgentDirectory()}/archive`)
              .set('Cookie', browser.cookies)
              .expect(404)
              .expect('Content-Type', /application\/json/ )
              .end(function(err, res) {
                if (err) done.fail(err);
                expect(res.body).toEqual({message: 'You have no invoices to archive'});
                done();
              });
          });
        });

        describe('with invoices', () => {
          beforeEach(done => {
            browser.on('confirm', function(obj) {
              expect(obj.question).toEqual('Have you zipped your current work and sent it to your supervisor?\n\nYou cannot retrieve your old claim.\n\nPress OK to start a new claim.');
              expect(obj.response).toBe(true);
            });
            done();
          });

          it('creates an archive directory if none exists', done => {
            fs.readdir(`uploads/${agent.getAgentDirectory()}`, (err, files) => {
              if (err) return done.fail(err);
              expect(files.indexOf('archive')).toEqual(-1);
              browser.pressButton('#archive-button', function(err) {
                if (err) done.fail(err);
                browser.assert.success();

                fs.readdir(`uploads/${agent.getAgentDirectory()}`, (err, files) => {
                  if (err) return done.fail(err);
                  expect(files.indexOf('archive') >= 0).toBe(true);

                  done();
                });
              });
            });
          });

          it('moves all an agent\'s images to the archive directory', done => {
            fs.readdir(`uploads/${agent.getAgentDirectory()}`, (err, files) => {
              if (err) return done.fail(err);
              expect(files.length).toEqual(4);

              browser.pressButton('#archive-button', function(err) {
                if (err) done.fail(err);
                browser.assert.success();

                fs.readdir(`uploads/${agent.getAgentDirectory()}`, (err, files) => {
                  if (err) return done.fail(err);
                  expect(files.indexOf('archive') >= 0).toBe(true);
                  expect(files.length).toEqual(1);
                  fs.readdir(`uploads/${agent.getAgentDirectory()}/archive`, (err, files) => {
                    if (err) return done.fail(err);
                    expect(files.indexOf('archive') >= 0).toBe(false);
                    expect(files.length).toEqual(4);

                    done();
                  });
                });
              });
            });
          });

          it('updates all invoice doc paths to point to archive directory', done => {
            models.Invoice.find({}).then(invoices => {
              expect(invoices.length).toEqual(3);
              for (let invoice of invoices) {
                expect(invoice.doc).toMatch(`${agent.getAgentDirectory()}`);
              }
              browser.pressButton('#archive-button', function(err) {
                if (err) done.fail(err);
                browser.assert.success();

                models.Invoice.find({}).then(invoices => {
                  expect(invoices.length).toEqual(3);
                  for (let invoice of invoices) {
                    expect(invoice.doc).toMatch(`archive/${agent.getAgentDirectory()}`);
                  }
                  done();
                });
              });
            }).catch(err => {
              done.fail(err);
            });
          });

          it('redirects to agent\'s images with message', done => {
            browser.pressButton('#archive-button', function(err) {
              if (err) done.fail(err);
              browser.assert.success();

              browser.assert.text('.alert.alert-success', 'You can now start a new expense claim');
              done();
            });
          });
        });
      });
    });

    describe('unauthorized', () => {
      it('does not display an archive form in an album the agent can read but does not own', done => {
        expect(agent.canRead.length).toEqual(1);
        expect(agent.canRead[0]).toEqual(lanny._id);

        browser.visit(`/image/${lanny.getAgentDirectory()}`, function(err) {
          if (err) return done.fail(err);
          browser.assert.success();
          browser.assert.elements(`form[action='/image/${agent.getAgentDirectory()}/archive']`, 0);
          done();
        });
      });

      it('does not archive anything', done => {
        request(app)
          .post(`/image/${lanny.getAgentDirectory()}/archive`)
          .set('Cookie', browser.cookies)
          .expect(401)
          .end(function(err, res) {
            if (err) done.fail(err);
            expect(res.body.message).toEqual('Unauthorized');
            done();
          });
      });
    });
  });

  describe('unauthenticated', () => {
    // This is getting caught by basic auth and redirecting to home
    it('does not return a archive file', done => {
      request(app)
        .post(`/image/${agent.getAgentDirectory()}/archive`)
        .expect(302)
        .end(function(err, res) {
          if (err) done.fail(err);

          expect(res.header.location).toEqual('/');
          done();
        });
    });
  });
});
