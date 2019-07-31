const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
Browser.localhost('example.com', PORT);
const fs = require('fs');
const app = require('../../app');
const fixtures = require('pow-mongoose-fixtures');
const models = require('../../models'); 
const jwt = require('jsonwebtoken');
const request = require('supertest');
const AdmZip = require('adm-zip');

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
  let browser, agent, lanny;

  beforeEach(function(done) {
    browser = new Browser({ waitDuration: '30s', loadCss: false });
    //browser.debug();
    fixtures.load(__dirname + '/../fixtures/agents.js', models.mongoose, function(err) {
      models.Agent.findOne({ email: 'daniel@example.com' }).then(function(results) {
        agent = results;
        models.Agent.findOne({ email: 'lanny@example.com' }).then(function(results) {
          lanny = results; 
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
          'image2.pdf': fs.readFileSync('spec/files/troll.jpg'),
          'image3.GiF': fs.readFileSync('spec/files/troll.jpg'),
          'image4': fs.readFileSync('spec/files/troll.jpg'),
        },
        [`uploads/${lanny.getAgentDirectory()}`]: {
          'lanny.jpg': fs.readFileSync('spec/files/troll.jpg'),
          'lanny.jpg': fs.readFileSync('spec/files/troll.jpg'),
          'lanny.jpg': fs.readFileSync('spec/files/troll.jpg'),
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
      it('displays a link to zip and download the images if viewing his own album', () => {
        browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}`});
        browser.assert.element(`a[href="/image/${agent.getAgentDirectory()}/zip"]`);
      });

      it('does not display a link to zip and download the images if there are no images', (done) => {
        mock.restore();
        browser.visit(`/image/${agent.getAgentDirectory()}`, function(err) {
          if (err) return done.fail(err);
          browser.assert.success();
          browser.assert.elements(`a[href="/image/${agent.getAgentDirectory()}/zip"]`, 0);
          done();
        });
      });

      it('compresses the image directory and returns a zip file', done => {
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
            let zipEntries = zip.getEntries();
            expect(zipEntries.length).toEqual(4);
            expect(res.header['content-disposition']).toMatch(`${agent.getBaseFilename()} #1-${zipEntries.length}.zip`);
            expect(zipEntries[0].name).toEqual(`${agent.getBaseFilename()} #1.jpg`);
            expect(zipEntries[1].name).toEqual(`${agent.getBaseFilename()} #2.pdf`);
            expect(zipEntries[2].name).toEqual(`${agent.getBaseFilename()} #3.gif`);
            expect(zipEntries[3].name).toEqual(`${agent.getBaseFilename()} #4`);
            done();
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
