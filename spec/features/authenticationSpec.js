'use strict';
const app = require('../../app'); 

const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
const fixtures = require('pow-mongoose-fixtures');
const models = require('../../models'); 

Browser.localhost('example.com', PORT);
      
// For when system resources are scarce
jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe('authentication', function() {

  var browser, agent, album;

  beforeEach(function(done) {
    browser = new Browser({ waitDuration: '30s', loadCss: false });
    //browser.debug();
    fixtures.load(__dirname + '/../fixtures/agents.js', models.mongoose, function(err) {
      models.Agent.findOne({ email: 'daniel@example.com' }).then(function(results) {
        agent = results;
        fixtures.load(__dirname + '/../fixtures/albums.js', models.mongoose, function(err) {
          if (err) done.fail(err);
          fixtures.load(__dirname + '/../fixtures/images.js', models.mongoose, function(err) {
            models.Image.findOne().then(function(results) {
              if (err) done.fail(err);
              agent.images.push(results);
              models.Agent.findOneAndUpdate({ '_id': agent._id }, agent, { new: true }).then(function(results){
                agent = results;
                browser.visit('/', function(err) {
                  if (err) done.fail(err);
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
    browser.assert.text('nav .navbar-header a', process.env.TITLE);
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
    beforeEach(function(done) {
      browser.fill('email', agent.email);
      browser.fill('password', 'secret');
      browser.pressButton('Login', function(err) {
        if (err) done.fail(err);
        browser.assert.success();
        done();
      });
    });

    it('does not display the login form', function() {
      expect(browser.query("form[action='/login']")).toBeNull();
    });

    it('displays a friendly greeting', function() {
      browser.assert.text('.alert', 'Hello, ' + agent.email + '!');
    });

    it("redirects to the agent's albums", function() {
      browser.assert.url({ pathname: '/album'});
    });


    it('displays image submission history', function(done) {
      expect(agent.images.length).toEqual(1);
      browser.assert.text('#images', 'Recent images');
      models.Image.count({ agent: agent._id }, function(err, count) {
        expect(browser.queryAll('.image').length).toEqual(count);
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
    });
  });
});
