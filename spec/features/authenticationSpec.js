'use strict';
const app = require('../../app'); 

const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
const fixtures = require('pow-mongoose-fixtures');
const models = require('../../models'); 

const fs = require('fs');
const mock = require('mock-fs');
const mockAndUnmock = require('../support/mockAndUnmock')(mock);

const request = require('supertest');

Browser.localhost('example.com', PORT);
      
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
      browser.assert.text('#page h1 a', process.env.TITLE);
    });
  
    it('displays the login form if not logged in', function() {
      browser.assert.attribute('form', 'action', '/login');
    });
  
    it('does not display the logout button if not logged in', function() {
      expect(browser.query("a[href='/logout']")).toBeNull();
    });
  
  //  it('does not display any images if not logged in', function() {
  //    expect(browser.queryAll('.image').length).toEqual(0);
  //  });
  
    describe('login process', function() {
  
      describe('unsuccessful', function () {
        it('shows an error message when password omitted', function(done) {
          browser.fill('email', agent.email);
          browser.pressButton('Login', function(err) {
            if (err) done.fail(err);
            browser.assert.text('.alert.alert-danger', 'Invalid email or password');
            done();
          });
        });
  
        it('shows an error message when email is omitted', function(done) {
          browser.fill('password', agent.password);
          browser.pressButton('Login', function(err) {
            if (err) done.fail(err);
            browser.assert.text('.alert.alert-danger', 'Invalid email or password');
            done();
          });
        });
  
        it('shows an error message when password and email are omitted', function(done) {
          browser.pressButton('Login', function(err) {
            if (err) done.fail(err);
            browser.assert.text('.alert.alert-danger', 'Invalid email or password');
            done();
          });
        });
  
        it('shows an error message when password is wrong', function(done) {
          browser.fill('email', agent.email);
          browser.fill('password', 'wrong');
          browser.pressButton('Login', function(err) {
            if (err) done.fail(err);
            browser.assert.text('.alert.alert-danger', 'Invalid email or password');
            done();
          });
        });
  
        it('shows an error message when email doesn\'t exist', function(done) {
          browser.fill('email', 'nosuchguy@example.com');
          browser.fill('password', 'wrong');
          browser.pressButton('Login', function(err) {
            if (err) done.fail(err);
            browser.assert.text('.alert.alert-danger', 'Invalid email or password');
            done();
          });
        });
      });
  
      describe('successful', function () {
        beforeEach(function(done) {
          mockAndUnmock({ 
            'uploads': {
              'image1.jpg': fs.readFileSync('spec/files/troll.jpg'),
              'image2.jpg': fs.readFileSync('spec/files/troll.jpg'),
              'image3.jpg': fs.readFileSync('spec/files/troll.jpg'),
            }
          });
  
          browser.fill('email', agent.email);
          browser.fill('password', 'secret');
          browser.pressButton('Login', function(err) {
            if (err) done.fail(err);
            browser.assert.success();
            done();
          });
        });
    
        afterEach(function() {
          mock.restore();
        });
  
        it('does not display the login form', function() {
          expect(browser.query("form[action='/login']")).toBeNull();
        });
    
        it('displays a friendly greeting', function() {
          browser.assert.text('.alert', 'Hello, ' + agent.email + '!');
        });
    
        it("redirects to the landing page", function() {
          browser.assert.url({ pathname: '/'});
        });
    
        it('displays image submission history', function() {
          expect(browser.queryAll('.image').length).toEqual(3);
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
        });
      });
    });
  });

  describe('app', () => {

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

    it('returns a cookie on successful sign in', (done) => {
      request(app)
        .post('/login')
        .send({ email: agent.email, password: 'secret' })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) done.fail(err);
          expect(res.headers['set-cookie']).toBeDefined();
          done();        
        });
    });

    it('returns a 403 json message on unsuccessful sign in', (done) => {
      request(app)
        .post('/login')
        .send({ email: agent.email, password: 'wrong' })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401)
        .end(function(err, res) {
          if (err) done.fail(err);
          expect(res.body.message).toEqual('Invalid email or password');
          expect(res.headers['set-cookie']).toBeUndefined();
          done();        
        });
    });
  });
});
