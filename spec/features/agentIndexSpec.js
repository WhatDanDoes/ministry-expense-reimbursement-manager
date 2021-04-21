const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
Browser.localhost('example.com', PORT);
const fs = require('fs');
const app = require('../../app');
const fixtures = require('pow-mongoose-fixtures');
const models = require('../../models'); 
const jwt = require('jsonwebtoken');

/**
 * `mock-fs` stubs the entire file system. So if a module hasn't
 * already been `require`d the tests will fail because the 
 * module doesn't exist in the mocked file system. `ejs` and
 * `iconv-lite/encodings` are required here to solve that 
 * problem.
 */
const mock = require('mock-fs');
const mockAndUnmock = require('../support/mockAndUnmock')(mock);

describe('agentIndexSpec', () => {
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
          'image3.jpg': fs.readFileSync('spec/files/troll.jpg'),
        },
        'public/images/uploads': {}
      });

      spyOn(jwt, 'sign').and.returnValue('somejwtstring');

      browser.fill('email', agent.email);
      browser.fill('password', 'secret');
      browser.pressButton('Login', function(err) {
        if (err) done.fail(err);
        browser.assert.success();

        browser.clickLink('Profile', function(err) {
          if (err) return done.fail(err);
          browser.assert.success();
          done();
        });
      });
    });

    afterEach(() => {
      mock.restore();
    });

    describe('authorized', () => {
      it('allows an agent to view his own profile', () => {
        browser.assert.url({ pathname: '/agent'});
        browser.assert.text('h2', `Hello, ${agent.email}`);
      });

      describe('readables', () => {
        it('shows a list of albums the agent can read', () => {
          expect(agent.canRead.length).toEqual(1);
          expect(agent.canRead[0]).toEqual(lanny._id);
          browser.assert.elements('.readables .agent a', 2);
          browser.assert.link('.readables .agent a', lanny.getAgentDirectory(), `/image/${lanny.getAgentDirectory()}`);
          browser.assert.link('.readables .agent a', agent.getAgentDirectory(), `/image/${agent.getAgentDirectory()}`);
        });

        it('counts the number of unprocessed invoices in a readable account', () => {
          expect(agent.canRead.length).toEqual(1);
          expect(agent.canRead[0]).toEqual(lanny._id);
          browser.assert.elements('.readables .agent .count', 2);
          browser.assert.text('.readables section.agent:nth-of-type(1) .count', '');
          browser.assert.text('.readables section.agent:nth-of-type(2) .count', '(3)');
        });

        it('lets the agent click and view a link he can read', done => {
          browser.clickLink(lanny.getAgentDirectory(), function(err) {
            if (err) return done.fail(err);
            browser.assert.success();
            done();
          });
        });
      });

      describe('writables', () => {
        it('shows a list of albums to which the agent can write', () => {
          expect(agent.canWrite.length).toEqual(1);
          expect(agent.canWrite[0]).toEqual(troy._id);
          browser.assert.elements('.writables .agent a', 2);
          browser.assert.link('.writables .agent a', troy.getAgentDirectory(), `/image/${troy.getAgentDirectory()}`);
          browser.assert.link('.writables .agent a', agent.getAgentDirectory(), `/image/${agent.getAgentDirectory()}`);
        });

        it('counts the number of unprocessed invoices in a writable account', () => {
          expect(agent.canWrite.length).toEqual(1);
          expect(agent.canWrite[0]).toEqual(troy._id);
          browser.assert.elements('.writables .agent .count', 2);
          browser.assert.text('.writables section.agent:nth-of-type(1) .count', '');
          browser.assert.text('.writables section.agent:nth-of-type(2) .count', '(3)');
        });

        it('lets the agent click and view a link he can read', done => {
          browser.clickLink(troy.getAgentDirectory(), function(err) {
            if (err) return done.fail(err);
            browser.assert.success();
            done();
          });
        });
      });
    });
  });

  describe('unauthenticated', () => {
    it('redirects home (which is where the login form is located)', done => {
      browser.visit('/agent', function(err) {
        if (err) return done.fail(err);
        browser.assert.redirected();
        browser.assert.url({ pathname: '/'});
        browser.assert.text('.alert.alert-danger', 'You need to login first');
        done();
      });
    });
  });
});
