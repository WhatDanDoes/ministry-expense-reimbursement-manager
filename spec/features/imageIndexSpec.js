const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
Browser.localhost('example.com', PORT);
const fs = require('fs');
const app = require('../../app');
const fixtures = require('pow-mongoose-fixtures');
const models = require('../../models'); 
const jwt = require('jsonwebtoken');
const isMobile = require('is-mobile');
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

describe('imageIndexSpec', () => {
  let browser, agent, lanny, troy;

  beforeEach(function(done) {
    browser = new Browser({ waitDuration: '30s', loadCss: false });
    browser.headers = {'user-agent': 'Mozilla/5.0 (Linux; Android 8.0.0; SM-G960F Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.84 Mobile Safari/537.36'};

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
          'image1.pdf': fs.readFileSync('spec/files/troll.jpg'),
          'image2.jpg': fs.readFileSync('spec/files/troll.jpg'),
          'image3.doc': fs.readFileSync('spec/files/troll.jpg'),
        },
        [`uploads/${troy.getAgentDirectory()}`]: {
          'troy1.jpg': fs.readFileSync('spec/files/troll.jpg'),
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

    afterEach(() => {
      mock.restore();
    });

    describe('authorized', () => {
      describe('owner album', () => {
        it('allows an agent to view his own album', () => {
          browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}`});
          browser.assert.elements('section.image img', 1);
          browser.assert.elements('section.link a', 2);
        });

        it('redirects /image to agent\'s personal album', done => {
          browser.visit(`/image`, function(err) {
            if (err) return done.fail(err);
            browser.assert.redirected();
            browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}`});
            done();
          });
        });

        it('displays an upload-files form', () => {
          browser.assert.element("form[action='/image']");
        });

        it('displays an archive-files link', () => {
          browser.assert.element(`form[action='/image/${agent.getAgentDirectory()}/archive']`);
        });

        it('writes a file upload to disk', done => {
          fs.readdir(`uploads/${agent.getAgentDirectory()}`, (err, files) => {
            if (err) {
              return done.fail(err);
            }
            // Three files written in setup
            expect(files.length).toEqual(3);

            request(app)
              .post('/image')
              .set('Accept', 'text/html')
              .set('Cookie', browser.cookies)
              .attach('docs', 'spec/files/troll.jpg')
              .expect('Content-Type', /html/)
              .expect(302) // redirect
              .end(function(err, res) {
                if (err) {
                  return done.fail(err);
                }

                fs.readdir(`uploads/${agent.getAgentDirectory()}`, (err, files) => {
                  if (err) {
                    return done.fail(err);
                  }
                  expect(files.length).toEqual(4);
                  done();
                });
            });
          });
        });

        it('writes multiple file uploads to disk', done => {
          fs.readdir(`uploads/${agent.getAgentDirectory()}`, (err, files) => {
            if (err) {
              return done.fail(err);
            }

            // Three files written in setup
            expect(files.length).toEqual(3);

            request(app)
              .post('/image')
              .set('Accept', 'text/html')
              .set('Cookie', browser.cookies)
              .attach('docs', 'spec/files/troll.jpg')
              .attach('docs', 'spec/files/troll.png')
              .expect('Content-Type', /html/)
              .expect(302) // redirect
              .end(function(err, res) {
                if (err) {
                  return done.fail(err);
                }
                expect(res.header.location).toEqual('/image');

                fs.readdir(`uploads/${agent.getAgentDirectory()}`, (err, files) => {
                  if (err) {
                    return done.fail(err);
                  }
                  expect(files.length).toEqual(5);
                  done();
                });
            });
          });
        });
      });

      describe('readable album', () => {
        beforeEach(done => {
          expect(agent.canRead.length).toEqual(1);
          expect(agent.canRead[0]).toEqual(lanny._id);

          browser.visit(`/image/${lanny.getAgentDirectory()}`, function(err) {
            if (err) return done.fail(err);
            browser.assert.success();
            done();
          });
        });

        it('allows an agent to view an album he can read', () => {
          browser.assert.text('h2', 'No invoices');
        });

        it('creates an agent directory if it does not exist already', done => {
          fs.rmdir(`uploads/${lanny.getAgentDirectory()}`, err => {
            if (err) return done.fail(err);
            expect(fs.existsSync(`uploads/${lanny.getAgentDirectory()}`)).toBe(false);
            browser.visit(`/image/${lanny.getAgentDirectory()}`, function(err) {
              if (err) return done.fail(err);
              browser.assert.success();
              expect(fs.existsSync(`uploads/${lanny.getAgentDirectory()}`)).toBe(true);
              done();
            });
          });
        });

        it('does not display an upload-files form', () => {
          browser.assert.elements("form[action='/image']", 0);
        });

        it('does not display an archive-files link', () => {
          browser.assert.elements(`form[action='/image/${agent.getAgentDirectory()}/archive']`, 0);
        });

        it('does not display jwt link if agent can read', () => {
          browser.assert.elements(`a[href="bpe://bpe?token=somejwtstring&domain=${encodeURIComponent(process.env.DOMAIN)}"]`, 0);
        });

        it('does not write a file upload to disk', done => {
          fs.readdir(`uploads/${lanny.getAgentDirectory()}`, (err, files) => {
            if (err) {
              return done.fail(err);
            }
            expect(files.length).toEqual(0);

            request(app)
              .post(`/image/${lanny.getAgentDirectory()}`)
              .set('Accept', 'text/html')
              .set('Cookie', browser.cookies)
              .attach('docs', 'spec/files/troll.jpg')
              .expect('Content-Type', /html/)
              .expect(302) // redirect
              .end(function(err, res) {
                if (err) {
                  return done.fail(err);
                }
                browser.assert.url({ pathname: `/image/${lanny.getAgentDirectory()}`});

                fs.readdir(`uploads/${lanny.getAgentDirectory()}`, (err, files) => {
                  if (err) {
                    return done.fail(err);
                  }
                  expect(files.length).toEqual(0);
                  done();
                });
            });
          });
        });
      });

      describe('writable album', () => {
        beforeEach(done => {
          expect(agent.canWrite.length).toEqual(1);
          expect(agent.canWrite[0]).toEqual(troy._id);

          browser.visit(`/image/${troy.getAgentDirectory()}`, function(err) {
            if (err) return done.fail(err);
            browser.assert.success();
            done();
          });
        });

        it('allows an agent to view an album to which he can write', () => {
          browser.assert.elements('section.image img', 1);
        });

        it('creates an agent directory if it does not exist already', done => {
          mock.restore();
          mockAndUnmock({ 
            'uploads/': {}
          });
          expect(fs.existsSync(`uploads/${troy.getAgentDirectory()}`)).toBe(false);
          browser.visit(`/image/${troy.getAgentDirectory()}`, function(err) {
            if (err) return done.fail(err);
            browser.assert.success();
            expect(fs.existsSync(`uploads/${troy.getAgentDirectory()}`)).toBe(true);
            done();
          });
        });

        it('displays an upload-files form', () => {
          browser.assert.element(`form[action='/image/${troy.getAgentDirectory()}']`);
        });

        it('displays an archive-files link', () => {
          browser.assert.element(`form[action='/image/${troy.getAgentDirectory()}/archive']`);
        });

        it('does not display jwt link if agent can write', () => {
          browser.assert.elements(`a[href="bpe://bpe?token=somejwtstring&domain=${encodeURIComponent(process.env.DOMAIN)}"]`, 0);
        });

        it('writes a file upload to disk', done => {
          fs.readdir(`uploads/${troy.getAgentDirectory()}`, (err, files) => {
            if (err) {
              return done.fail(err);
            }
            expect(files.length).toEqual(1);

            request(app)
              .post(`/image/${troy.getAgentDirectory()}`)
              .set('Accept', 'text/html')
              .set('Cookie', browser.cookies)
              .attach('docs', 'spec/files/troll.jpg')
              .expect('Content-Type', /html/)
              .expect(302) // redirect
              .end(function(err, res) {
                if (err) {
                  return done.fail(err);
                }

                expect(res.header.location).toEqual(`/image/${troy.getAgentDirectory()}`);

                fs.readdir(`uploads/${troy.getAgentDirectory()}`, (err, files) => {
                  if (err) {
                    return done.fail(err);
                  }
                  expect(files.length).toEqual(2);
                  done();
                });
            });
          });
        });
      });
    });

    describe('unauthorized', () => {
      it('does not allow an agent to view an album for which he has not been granted access', done => {
        agent.canWrite.pop();
        agent.save().then(function(agent) {
          models.Agent.findOne({ email: 'troy@example.com' }).then(function(troy) {
            expect(agent.canRead.length).toEqual(1);
            expect(agent.canRead[0]).not.toEqual(troy._id);
            expect(agent.canWrite.length).toEqual(0);

            browser.visit(`/image/${troy.getAgentDirectory()}`, function(err) {
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
      browser.visit(`/image/${agent.getAgentDirectory()}`, function(err) {
        if (err) return done.fail(err);
        browser.assert.redirected();
        browser.assert.url({ pathname: '/'});
        browser.assert.text('.alert.alert-danger', 'You need to login first');
        done();
      });
    });

    it('redirects /image to home', done => {
      browser.visit('/image', function(err) {
        if (err) return done.fail(err);
        browser.assert.redirected();
        browser.assert.url({ pathname: '/'});
        browser.assert.text('.alert.alert-danger', 'You need to login first');
        done();
      });
    });
  });

  describe('pagination', () => {
    beforeEach(done => {
      let files = {};
      for (let i = 0; i < 70; i++) {
        files[`image${i}.jpg`] = fs.readFileSync('spec/files/troll.jpg');
      }
      mockAndUnmock({ [`uploads/${agent.getAgentDirectory()}`]: files });

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

    it('paginates images in the agent\'s album', done => {
      browser.visit(`/image/${agent.getAgentDirectory()}`, (err) => {
        if (err) return done.fail(err);
        browser.assert.success();
        browser.assert.elements('section.image img', 30);
        browser.assert.elements('#next-page', 2);
        browser.assert.link('#next-page', 'Next', `/image/${agent.getAgentDirectory()}/page/2`);
        browser.assert.elements('#previous-page', 0);

        browser.clickLink('#next-page', (err) => {
          if (err) return done.fail(err);
          browser.assert.elements('section.image img', 30);
          browser.assert.link('#next-page', 'Next', `/image/${agent.getAgentDirectory()}/page/3`);
          browser.assert.link('#prev-page', 'Previous', `/image/${agent.getAgentDirectory()}/page/1`);

          browser.clickLink('#next-page', (err) => {
            if (err) return done.fail(err);
            browser.assert.elements('section.image img', 10);
            browser.assert.elements('#next-page', 0);
            browser.assert.link('#prev-page', 'Previous', `/image/${agent.getAgentDirectory()}/page/2`);

            browser.clickLink('#prev-page', (err) => {
              if (err) return done.fail(err);
              browser.assert.elements('section.image img', 30);
              browser.assert.link('#next-page', 'Next', `/image/${agent.getAgentDirectory()}/page/3`);
              browser.assert.link('#prev-page', 'Previous', `/image/${agent.getAgentDirectory()}/page/1`);

              browser.clickLink('#prev-page', (err) => {
                if (err) return done.fail(err);
                browser.assert.elements('section.image img', 30);
                browser.assert.link('#next-page', 'Next', `/image/${agent.getAgentDirectory()}/page/2`);
                browser.assert.elements('#previous-page', 0);

                done();
              });
            });
          });
        });
      });
    });

    it('doesn\'t barf if paginating beyond the bounds', done => {
      browser.visit(`/image/${agent.getAgentDirectory()}/page/10`, (err) => {
        if (err) return done.fail(err);
        browser.assert.text('h2', 'No invoices');

        browser.visit(`/image/${agent.getAgentDirectory()}/page/0`, (err) => {
          if (err) return done.fail(err);
          browser.assert.text('h2', 'No invoices');

          done();
          // Negative page params work, kinda
        });
      });
    });
  });

  describe('mobile detection', () => {
    beforeEach(done => {
      mockAndUnmock({ 
        [`uploads/${agent.getAgentDirectory()}`]: {
          'image1.jpg': fs.readFileSync('spec/files/troll.jpg'),
          'image2.jpg': fs.readFileSync('spec/files/troll.jpg'),
          'image3.jpg': fs.readFileSync('spec/files/troll.jpg'),
        },
        'public/images/uploads': {}
      });

      spyOn(jwt, 'sign').and.returnValue('somejwtstring');

      browser = new Browser({ waitDuration: '30s', loadCss: false });

      done();
    });

    afterEach(() => {
      mock.restore();
    });

    it('displays an Android deep link with JWT if browser is mobile', done => {
      browser.headers = {'user-agent': 'Mozilla/5.0 (Linux; Android 8.0.0; SM-G960F Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.84 Mobile Safari/537.36'};
      browser.visit('/', function(err) {
        if (err) return done.fail(err);
        browser.assert.success();

        browser.fill('email', agent.email);
        browser.fill('password', 'secret');
        browser.pressButton('Login', function(err) {
          if (err) done.fail(err);
          browser.assert.success();
          browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}`});
          browser.assert.element(`a[href="bpe://bpe?token=somejwtstring&domain=${encodeURIComponent(process.env.DOMAIN)}"]`);
          done();
        });
      });
    });

    it('does not display an Android deep link if browser is not mobile', done => {
      browser.visit('/', function(err) {
        if (err) return done.fail(err);
        browser.assert.success();

        browser.fill('email', agent.email);
        browser.fill('password', 'secret');
        browser.pressButton('Login', function(err) {
          if (err) done.fail(err);
          browser.assert.success();
          browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}`});
          browser.assert.elements(`a[href="bpe://bpe?token=somejwtstring&domain=${encodeURIComponent(process.env.DOMAIN)}"]`, 0);

          done();
        });
      });
    });

    describe('pagination', () => {
      beforeEach(done => {
        let files = {};
        for (let i = 0; i < 70; i++) {
          files[`image${i}.jpg`] = fs.readFileSync('spec/files/troll.jpg');
        }
        mockAndUnmock({ 
          [`uploads/${agent.getAgentDirectory()}`]: files,
          'public/images/uploads': {}
        });
        done();
      });

      afterEach(() => {
        mock.restore();
      });

      it('displays an Android deep link with JWT if browser is mobile', done => {
        browser.headers = {'user-agent': 'Mozilla/5.0 (Linux; Android 8.0.0; SM-G960F Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.84 Mobile Safari/537.36'};
        browser.visit('/', function(err) {
          if (err) return done.fail(err);
          browser.assert.success();

          browser.fill('email', agent.email);
          browser.fill('password', 'secret');
          browser.pressButton('Login', function(err) {
            if (err) done.fail(err);
            browser.assert.success();

            browser.clickLink('#next-page', function(err) {
              if (err) done.fail(err);
              browser.assert.success();
              browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}/page/2`});
              browser.assert.element(`a[href="bpe://bpe?token=somejwtstring&domain=${encodeURIComponent(process.env.DOMAIN)}"]`);
              done();
            });
          });
        });
      });

      it('displays a file upload form if browser is not mobile', done => {
        browser.visit('/', function(err) {
          if (err) return done.fail(err);
          browser.assert.success();

          browser.fill('email', agent.email);
          browser.fill('password', 'secret');
          browser.pressButton('Login', function(err) {
            if (err) done.fail(err);
            browser.assert.success();

            browser.clickLink('#next-page', function(err) {
              if (err) done.fail(err);
              browser.assert.success();
              browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}/page/2`});
              browser.assert.elements(`a[href="bpe://bpe?token=somejwtstring&domain=${encodeURIComponent(process.env.DOMAIN)}"]`, 0);

              done();
            });
          });
        });
      });
    });
  });
});
