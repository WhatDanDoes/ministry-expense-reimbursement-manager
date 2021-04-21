'use strict';
const app = require('../../app');

const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const DOMAIN = 'example.com';
Browser.localhost(DOMAIN, PORT);

const fixtures = require('pow-mongoose-fixtures');
const models = require('../../models');

const fs = require('fs');
const mock = require('mock-fs');
const mockAndUnmock = require('../support/mockAndUnmock')(mock);

const request = require('supertest');
const jwt = require('jsonwebtoken');

const stubAuth0Sessions = require('../support/stubAuth0Sessions');

// For when system resources are scarce
jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe('authentication', function() {

  var browser, agent, album;

  describe('web', () => {
    beforeEach(function(done) {
      browser = new Browser({ waitDuration: '30s', loadCss: false });
      //browser.debug();
      fixtures.load(__dirname + '/../fixtures/agents.js', models.mongoose, function(err) {
        models.Agent.findOne({ email: 'daniel@example.com' }).then(function(results) {
          agent = results;
          browser.visit('/', function(err) {
            if (err) return done.fail(err);
            browser.assert.success();
            done();
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

    it('shows the home page', function() {
      browser.assert.text('#page a .splash', 'Ministry Expense Reimbursement Manager');
    });

    it('displays the login form if not logged in', function() {
      browser.assert.attribute('form', 'action', '/login');
    });

    it('does not display the logout button if not logged in', function() {
      expect(browser.query("a[href='/logout']")).toBeNull();
    });

    describe('login process', function() {

      describe('successful', function () {
        beforeEach(function(done) {
          stubAuth0Sessions(agent.email, DOMAIN, err => {
            if (err) return done.fail(err);

            mockAndUnmock({
              [`uploads/${agent.getAgentDirectory()}`]: {
                'image1.jpg': fs.readFileSync('spec/files/troll.jpg'),
                'image2.jpg': fs.readFileSync('spec/files/troll.jpg'),
                'image3.jpg': fs.readFileSync('spec/files/troll.jpg'),
              },
              'public/images/uploads': {}
            });

            browser.clickLink('Login', function(err) {
              if (err) return done.fail(err);
              browser.assert.success();
              done();
            });
          });
        });

        afterEach(function() {
          mock.restore();
        });

        it('does not display the login link', function() {
          expect(browser.query("a[href='/login']")).toBeNull();
        });

        it('displays a friendly greeting', function() {
          browser.assert.text('.alert', 'Hello, ' + agent.email + '!');
        });

        it("redirects to the agent's album page", function() {
          browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}`});
        });

        it('displays image submission history', function() {
          expect(browser.queryAll('.image').length).toEqual(3);
        });

        it('displays link to the agent\'s images', function() {
          browser.assert.link('nav ul li a', 'Invoices', `/image/${agent.getAgentDirectory()}`);
        });

        it('does not display the login link on the landing page', function(done) {
          browser.visit('/', err => {
            if (err) return done.fail(err);
            browser.assert.success();
            browser.assert.elements('a[href="/login"]', 0);
            done();
          });
        });

        describe('logout', function() {
          it('does not display the logout button if not logged in', function(done) {
            browser.clickLink('Logout', function(err) {
              if (err) {
                done.fail(err);
              }
              browser.assert.success();
              expect(browser.query("a[href='/logout']")).toBeNull();
              browser.assert.attribute('form', 'action', '/login');
              done();
            });
          });

          it('removes the session', done => {
            models.db.collection('sessions').find().toArray(function(err, sessions) {
              if (err) {
                return done.fail(err);
              }
              expect(sessions.length).toEqual(1);

              // Can't click logout because it will create a new empty session
              request(app)
                .get('/logout')
                .set('Cookie', browser.cookies)
                .set('Accept', 'application/json')
                .expect(302)
                .end(function(err, res) {
                  if (err) done.fail(err);

                  models.db.collection('sessions').find().toArray(function(err, sessions) {
                    if (err) {
                      return done.fail(err);
                    }
                    expect(sessions.length).toEqual(0);
                    done();
                  });
              });
            });
          });
        });
      });
    });
  });

  /**
   * 2021-4-21
   *
   * Apart from two tests (commented below), this all works as prescribed
   * _post_ Auth0 integration. This is only relevant to the native app old
   * passport-local stuff.
   *
   * I leave it here because that JWT refresh stuff may come in handy some day
   */
  describe('api', () => {

    beforeEach(function(done) {
      fixtures.load(__dirname + '/../fixtures/agents.js', models.mongoose, function(err) {
        models.Agent.findOne({ email: 'daniel@example.com' }).then(function(results) {
          agent = results;
          done();
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

    describe('login', () => {
      //it('returns a jwt on successful sign in', (done) => {
      //  request(app)
      //    .post('/login/api')
      //    .send({ email: agent.email, password: 'secret' })
      //    .set('Accept', 'application/json')
      //    .expect('Content-Type', /json/)
      //    .expect(201)
      //    .end(function(err, res) {
      //      if (err) done.fail(err);
      //      expect(res.body.message).toEqual('Hello, ' + agent.email + '!');
      //      expect(res.body.token).toBeDefined();
      //      done();
      //    });
      //});

      //it('returns a 403 json message on unsuccessful sign in', (done) => {
      //  request(app)
      //    .post('/login/api')
      //    .send({ email: agent.email, password: 'wrong' })
      //    .set('Accept', 'application/json')
      //    .expect('Content-Type', /json/)
      //    .expect(401)
      //    .end(function(err, res) {
      //      if (err) done.fail(err);
      //      expect(res.body.message).toEqual('Invalid email or password');
      //      expect(res.headers['set-cookie']).toBeUndefined();
      //      done();
      //    });
      //});
    });

    describe('token refresh', () => {
      it('returns the same payload with a refreshed expiry', done => {
        const token = jwt.sign({ email: agent.email, iat: Math.floor(Date.now() / 1000) - (60 * 30) }, process.env.SECRET, { expiresIn: '1h' });
        jwt.verify(token, process.env.SECRET, function(err, decoded) {
          if (err) {
            done.fail(err);
          }
          expect(decoded.email).toEqual(agent.email);

          request(app)
            .post('/login/refresh')
            .send({ token: token })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) done.fail(err);
              jwt.verify(res.body.token, process.env.SECRET, function(err, newDecoded) {
                if (err) {
                  done.fail(err);
                }
                expect(token).not.toEqual(res.body.token);
                expect(newDecoded.email).toEqual(decoded.email);
                expect(newDecoded.exp).toBeGreaterThan(decoded.exp);
                done();
              });
            });
        });
      });

      it('returns 401 if provided an expired token', done => {
        const expiredToken = jwt.sign({ email: agent.email, iat: Math.floor(Date.now() / 1000) - (60 * 60) }, process.env.SECRET, { expiresIn: '1h' });
        request(app)
          .post('/login/refresh')
          .send({ token: expiredToken})
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(401)
          .end(function(err, res) {
            if (err) done.fail(err);
              expect(res.body.message).toEqual('Unauthorized: Invalid token');
              done();
            });
      });

      it('returns 401 if provided no token', done => {
        request(app)
          .post('/login/refresh')
          .send({})
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(401)
          .end(function(err, res) {
            if (err) done.fail(err);
              expect(res.body.message).toEqual('Unauthorized: No token provided');
              done();
            });
      });
    });
  });
});
