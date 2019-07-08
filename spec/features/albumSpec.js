'use strict';

const Browser = require('zombie');
const fixtures = require('pow-mongoose-fixtures');
const models = require('../../models'); 
const path = require('path');

const app = require('../../app'); 
const request = require('supertest');

const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
Browser.localhost('example.com', PORT);

// For when system resources are scarce
jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe("GET '/'", () => {

  let browser, agent, album, fake;

  beforeEach((done) => {
    browser = new Browser({ waitDuration: '30s', loadCss: false });

    // browser.debug();
    fixtures.load(__dirname + '/../fixtures/agents.js', models.mongoose, (err) => {
      models.Agent.findOne({ email: 'daniel@example.com' }).then((results) => {
        agent = results;

        fixtures.load(__dirname + '/../fixtures/albums.js', models.mongoose, (err) => {
          if (err) done.fail(err);
          models.Album.findOne().then((results) => {
            album = results;
 
            fixtures.load(__dirname + '/../fixtures/images.js', models.mongoose, (err) => {
              if (err) done.fail(err);

              models.Image.find({}).distinct('_id').then((images) => {
                album.images = images;
                models.Album.findOneAndUpdate({ '_id': album._id }, album, { new: true }).then((results) => {

                  agent.images = images;
                  models.Agent.findOneAndUpdate({ '_id': agent._id }, agent, { new: true }).then((results) => {
                    agent = results;
                    browser.visit('/', (err) => {
                      if (err) done.fail(err);
                      browser.assert.success();
                      done();
                    });
                  }).catch((err) => {
                    done.fail(err);
                  });
                }).catch((err) => {
                  done.fail(err);
                });
              }).catch((err) => {
                done.fail(err);
              });
            });
          }).catch((err) => {
            done.fail(err);
          });
        });
      }).catch((err) => {
        done.fail(err);
      });
    });
  });

  afterEach((done) => {
    models.mongoose.connection.db.dropDatabase().then((err, result) => {
      done();
    }).catch((err) => {
      done.fail(err);         
    });
  });

  describe('unauthenticated access', () => {

    it('does not show form to submit album', () => {
      expect(browser.query("form[action='/album']")).toBeNull();
    });

    /**
     * POST /album
     */
    it('does not allow posting albums', (done) => {
      request(app)
        .post('/album')
        .field('name', 'Old Barns')
        .end((err, res) => {
          if (err) return done.fail(err);
          expect(res.status).toEqual(401);
          done();
        });
    });

    /**
     * GET /album/:id
     */
    it('does not allow viewing albums', (done) => {
      request(app)
        .get('/album/123')
        .end((err, res) => {
          if (err) return done.fail(err);
          expect(res.status).toEqual(401);
          done();
        });
    });
  });

  describe('authenticated access', () => {
    beforeEach((done) => {
      browser.fill('email', agent.email);
      browser.fill('password', 'secret');
      browser.pressButton('Login', (err) => {
        if (err) done.fail(err);
        browser.assert.success();
        browser.assert.url('/album');
        done();
      });
    });

    it('orders images in descending order of when they were created', (done) => {
      models.Image.find({}).sort({ createdAt: 'desc' }).then((results) => {
        expect(results.length).toEqual(3);
        expect(browser.queryAll('.image.pending').length).toEqual(3);
        // Ensure images have their album name displayed
        expect(browser.queryAll('.image .album', results[0].album.name).length).toEqual(3);
        expect(browser.queryAll('.image .album', results[1].album.name).length).toEqual(3);
        expect(browser.queryAll('.image .album', results[2].album.name).length).toEqual(3);

        let links = browser.queryAll('.image.pending .title a');
        expect(links[0].getAttribute('href')).toEqual('/image/' + results[0]._id);
        expect(links[1].getAttribute('href')).toEqual('/image/' + results[1]._id);
        expect(links[2].getAttribute('href')).toEqual('/image/' + results[2]._id);

        done();
      }).catch((err) => {
        done.fail(err);
      });
    });

    /**
     * POST /album
     */
    describe('submit album', () => {
      it('shows form to submit album', (done) => {
        browser.assert.attribute('#new-album-form', 'action', '/album');
        browser.assert.element('form input[name=name]');
        done();
      });
  
      describe('successful album submission by member agent', () => {
        it('lands on new album page with a success message', (done) => {
          browser.fill('name', 'TaxReformYYC');
          browser.pressButton('Open New', (err) => {
            if (err) done.fail(err);
            models.Agent.findById(agent._id).then((agent) => {
              if (err) done.fail(err);
              browser.assert.success();

              models.Album.findOne({ name: 'TaxReformYYC' }).then((album) => {
                browser.assert.url({ pathname: '/album/' + album._id });
                browser.assert.text('.alert.alert-success', album.name + ' is open');
                done();
              }).catch((err) => {
                done.fail(err);
              });
            }).catch((err) => {
              done.fail(err);
            });
          });
        });

        it('gives the creator agent full administrative privileges', (done) => {
          expect(agent.reviewables.length).toEqual(0);
          expect(agent.submittables.length).toEqual(1);
          expect(agent.viewables.length).toEqual(0);
          browser.fill('name', 'TaxReformYYC');
          browser.pressButton('Open New', (err) => {
            if (err) done.fail(err);
            browser.assert.success();

            models.Agent.findById(agent._id).then((agent) => {
              expect(agent.reviewables.length).toEqual(1);
              expect(agent.submittables.length).toEqual(2);
              expect(agent.viewables.length).toEqual(1);
 
              models.Album.findOne({ name: 'TaxReformYYC' }).then((album) => {
                expect(album.reviewers.length).toEqual(1);
                expect(album.submitters.length).toEqual(1);
                expect(album.viewers.length).toEqual(1);

                done();
              }).catch((err) => {
                done.fail(err);
              });
            }).catch((err) => {
              done.fail(err);
            });
          });

        });

        it('displays the submitted album on the home page and allows agent to submit image', (done) => {
          browser.assert.elements('#album-list .album', 1);
          browser.fill('name', 'Fun Pics');
          browser.pressButton('Open New', (err) => {
            if (err) done.fail(err);
            browser.assert.elements('#album-list .album', 2);
            models.Album.findOne({ name: 'Fun Pics' }).then((album) => {
              browser.assert.link('.album a', album.name, '/album/' + album._id);
              browser.assert.element('option[value="' + album._id + '"]');
              // Submit image to new album
              browser.select('album', 'Fun Pics');
              browser.fill('title', 'Some picture I tookl');
              browser.attach('docs', 'spec/files/receipt.jpg');
              browser.pressButton('Submit', (err) => {
                if (err) done.fail(err);
                browser.assert.success();
                browser.assert.url({ pathname: '/album' });
                browser.assert.text('.alert.alert-success',
                        'Image successfully submitted to ' + album.name);
                done();
              });
            }).catch((err) => {
              done.fail(err);
            });
          });
        });
      });

      describe('unsuccessful album submission', () => {
        beforeEach((done) => {
          models.Album.findOne().then((results) => {
            album = results;
            done();
          }).catch((err) => {
            done.fail(err);
          });
        });

        it('does not create an album unless a name is provided', (done) => {
          browser.assert.elements('#album-list .album', 1);
          browser.fill('name', '   ');
          browser.pressButton('Open New', (err) => {
            if (err) done.fail(err);
            browser.assert.success();
            browser.assert.elements('#album-list .album', 1);
            models.Album.find({}).then((albums) => {
              expect(albums.length).toEqual(1);
              browser.assert.text('.alert.alert-danger', 'No album name supplied');

              done();
            }).catch((err) => {
              done.fail(err);
            });
          });
        });
      });
    });
  });
});
