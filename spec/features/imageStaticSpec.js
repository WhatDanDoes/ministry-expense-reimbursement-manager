const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
Browser.localhost('example.com', PORT);
const fs = require('fs');
const app = require('../../app');
const fixtures = require('pow-mongoose-fixtures');
const models = require('../../models'); 
const request = require('supertest');
const path = require('path');

/**
 * `mock-fs` stubs the entire file system. So if a module hasn't
 * already been `require`d the tests will fail because the 
 * module doesn't exist in the mocked file system. `ejs` and
 * `iconv-lite/encodings` are required here to solve that 
 * problem.
 */
const mock = require('mock-fs');
const mockAndUnmock = require('../support/mockAndUnmock')(mock);

describe('imageStaticSpec', () => {
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

    describe('authorized', () => {
      it('allows an agent to view his own static image file', done => {
        request(app)
          .get(`/uploads/${agent.getAgentDirectory()}/image1.jpg`)
          .set('Cookie', browser.cookies)
          .expect(200)
          .end(function(err, res) {
            if (err) done.fail(err);
            done();
          });
      });

      it('allows an agent to view a static image file he is allowed read', done => {
        expect(agent.canRead.length).toEqual(1);
        expect(agent.canRead[0]).toEqual(lanny._id);
        request(app)
          .get(`/uploads/${lanny.getAgentDirectory()}/lanny1.jpg`)
          .set('Cookie', browser.cookies)
          .expect(200)
          .end(function(err, res) {
            if (err) done.fail(err);
            done();
          });
      });

      it('allows an agent to view a static image file to which he is allowed to write', done => {
        expect(agent.canWrite.length).toEqual(1);
        expect(agent.canWrite[0]).toEqual(troy._id);
        request(app)
          .get(`/uploads/${troy.getAgentDirectory()}/troy1.jpg`)
          .set('Cookie', browser.cookies)
          .expect(200)
          .end(function(err, res) {
            if (err) done.fail(err);
            done();
          });
      });
    });

    describe('unauthorized', () => {
      it('does not allow an agent to view a static image for which he has not been granted access', done => {
        agent.canRead.pop();
        agent.canWrite.pop();
        //models.Agent.findOne({ email: 'troy@example.com' }).then(function(troy) {
        agent.save().then(function(agent) {
          expect(agent.canRead.length).toEqual(0);
          expect(agent.canWrite.length).toEqual(0);

          request(app)
            .get(`/uploads/${troy.getAgentDirectory()}/troy.jpg`)
            .set('Cookie', browser.cookies)
            .expect(403)
            .end(function(err, res) {
              if (err) done.fail(err);
              done();
            });
        }).catch(function(error) {
          done.fail(error);
        });
      });
    });
  });

  describe('unauthenticated', () => {
    it('returns a 404', done => {
      request(app)
        .get(`/uploads/${agent.getAgentDirectory()}/image1.jpg`)
        .set('Cookie', browser.cookies)
        .expect(404)
        .end(function(err, res) {
          if (err) done.fail(err);
          done();
        });
    });
  });
});
