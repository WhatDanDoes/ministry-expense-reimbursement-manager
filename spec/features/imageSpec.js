'use strict';

const Browser = require('zombie');
const fixtures = require('pow-mongoose-fixtures');
const models = require('../../models'); 
const path = require('path');

const app = require('../../app'); 
const request = require('supertest');

const fs = require('fs');

const mock = require('mock-fs');
const mockAndUnmock = require('../support/mockAndUnmock')(mock);

const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
Browser.localhost('example.com', PORT);

// For when system resources are scarce
jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe('image', function() {

  var browser, agent, album, fake;

  beforeEach(function(done) {
    browser = new Browser({ waitDuration: '30s', loadCss: false });

    // browser.debug();
    fixtures.load(__dirname + '/../fixtures/agents.js', models.mongoose, function(err) {
      models.Agent.findOne({ email: 'daniel@example.com' }).then(function(results) {
        agent = results;
        fixtures.load(__dirname + '/../fixtures/albums.js', models.mongoose, function(err) {
          if (err) done.fail(err);
          models.Album.findOne().then(function(results) {
            album = results;
            fixtures.load(__dirname + '/../fixtures/images.js', models.mongoose, function(err) {
              if (err) done.fail(err);
              browser.visit('/', function(err) {
                if (err) done.fail(err);
                browser.assert.success();
                done();
              });
            }); // Image fixtures
          }).catch((err) => {
            done.fail(err);
          }); // Album find
        }); // Album fixtures
      }).catch((err) => {
        done.fail(err);
      }); // Agent find
    }); // Agent fixtures
  });

  afterEach(function(done) {
    models.mongoose.connection.db.dropDatabase().then(function(err, result) {
      done();
    }).catch(function(err) {
      done.fail(err);         
    });
  });

  describe('unauthenticated access', function() {
    it('does not show form to submit image', function() {
      expect(browser.query("form[action='/image']")).toBeNull();
    });

    /**
     * POST /image
     */
    it('does not allow posting images', function(done) {
      mockAndUnmock({
        'spec/files/receipt.jpg': 'file content here',
        'uploads': { /* empty directory */ }
      });
      request(app)
        .post('/image')
        .field('album', 'somealbumobjectid')
        .field('title', 'Legitimate business expense')
        .attach('docs', 'spec/files/receipt.jpg')
        .end(function(err, res) {
          if (err) return done.fail(err);
          expect(res.status).toEqual(401);
          mock.restore();
          done();
        });
    });

    /**
     * GET /image/:id
     */
    it('does not allow viewing images', function(done) {
      request(app)
        .get('/image/123')
        .end(function(err, res) {
          if (err) return done.fail(err);
          expect(res.status).toEqual(401);
          done();
        });
    });
  });

  describe('authenticated access', function() {
    beforeEach(function(done) {
      agent.populate('submittables', function(err, result) {
        if (err) done.fail(err);
        agent = result
        expect(agent.submittables.length).toEqual(1);

        var date = new Date();
        var dir = 'imageFiles/' + date.getFullYear() + '/' + date.getMonth() + '/' + date.getDate();
  
        browser.fill('email', agent.email);
        browser.fill('password', 'secret');
        browser.pressButton('Login', function(err) {
          if (err) done.fail(err);
          browser.assert.success();

          mockAndUnmock({
            'spec/files': {
              'receipt.jpg': fs.readFileSync('spec/files/receipt.jpg'),
              'receipt.gif': fs.readFileSync('spec/files/receipt.gif'),
              'some crazy receipt.gif': fs.readFileSync('spec/files/receipt.gif')
            },
            'spec/fixtures/imageFiles.js': fs.readFileSync('spec/fixtures/imageFiles.js'),
            'uploads': { /* empty directory */ },
            '/tmp': { /* empty directory */ }
          });
          done();
        });
      });
    });

    afterEach(function() {
      mock.restore();
    });

    /**
     * POST /image
     */
    describe('submit image', function() {
      it('shows form to submit image', function(done) {
        browser.assert.attribute('#submit-image section form', 'action', '/image/home');
        browser.assert.element('form select[name=album]');
        browser.assert.element('form input[name=title]');
        browser.assert.element('form input[name=docs]');
        browser.assert.element('form input[name=tookPlaceAt]');
  
        // Select dropdown
        models.Album.find({}, function(err, albums) {
          if (err) done.fail(err);
          albums.forEach(function(album) {
            browser.assert.element('option[value="' + album._id + '"]');
          });
          done();
        });
      });
  
      //
      // 2016-10-31 How do I test multiple file uploads with zombie?
      //
  //    it('allows posting multiple files with image', function(done) {
  //      browser
  //        .select('album', 'Summer Memories')
  //        .fill('title', 'Some great photo')
  //        .attach('docs', 'spec/files/receipt.jpg')
  //        .attach('docs', 'spec/files/receipt.gif')
  //        .pressButton('Submit', function(err) {
  //          if (err) console.log('ERROR ' + err);
  //          browser.assert.success();
  //          browser.assert.text('.alert', 'Images successfully submitted to ' + album.name);
  //          done();
  //        });
  //    });
  
      describe('successful image submission by member agent', function() {
        it('lands on album index with a success message for image with file upload', function(done) {
          expect(agent.submittables[0].name).toEqual('Summer Memories');
          browser.select('album', 'Summer Memories');
          browser.fill('title', 'some picture');
          browser.attach('docs', 'spec/files/receipt.jpg');
          browser.pressButton('Submit', function(err) {
            if (err) done.fail(err);
            browser.assert.success();
            browser.assert.url({ pathname: '/album' });
            browser.assert.text('.alert', 'Image successfully submitted to ' + album.name);
            done();
          });
        });
    
        it('gives a success message for image with notes', function(done) {
          expect(agent.submittables[0].name).toEqual('Summer Memories');
          browser.select('album', 'Summer Memories');
          browser.fill('title', 'some picture');
          browser.attach('docs', 'spec/files/receipt.jpg');
          browser.fill('notes', 'taken in my yard');
          browser.pressButton('Submit', function(err) {
            if (err) done.fail(err);
            browser.assert.success();
            browser.assert.text('.alert', 'Image successfully submitted to ' + album.name);
            done();
          });
        });
 
        it('creates a new image record with a file upload in the database', function(done) {
          models.Image.count(function(err, count) {
            // Two loaded from fixtures
            expect(count).toEqual(3);
            browser.select('album', 'Summer Memories');
            browser.fill('title', 'Some great photo');
            browser.attach('docs', 'spec/files/receipt.jpg');
            browser.pressButton('Submit', function(err) {
              if (err) done.fail(err);
              browser.assert.success();
              browser.assert.text('.alert', 'Image successfully submitted to ' + album.name);
              models.Image.count(function(err, count) {
                expect(count).toEqual(4);
                done();
              });
            });
          });
        });

//        it('creates a new image record with no documentation in the database', function(done) {
//          models.Image.count(function(err, count) {
//            // Two loaded from fixtures
//            expect(count).toEqual(3);
//            browser
//              .select('album', 'Summer Memories')
//              .fill('title', 'Some great photo')
//              .fill('total', '$9.99')
//              .pressButton('Submit', function(err) {
//                if (err) done.fail(err);
//                browser.assert.success();
//                browser.assert.text('.alert', 'Image successfully submitted to ' + album.name);
//                models.Image.count(function(err, count) {
//                  expect(count).toEqual(4);
//                  done();
//                });
//              });
//            });
//        });
 
    
        it('creates a new image record with file associated with an agent in the database', function(done) {
          agent.populate('images', function(err, agent) {
            if (err) done.fail(err);
            expect(agent.images.length).toEqual(0);
            browser.select('album', 'Summer Memories');
            browser.fill('title', 'Some great photo');
            browser.attach('docs', 'spec/files/receipt.jpg');
            browser.pressButton('Submit', function(err) {
              if (err) done.fail(err);
              browser.assert.success();
              browser.assert.text('.alert', 'Image successfully submitted to ' + album.name);
              models.Agent.findById(agent._id).populate('images').then(function(agent) {
                expect(agent.images.length).toEqual(1);
                done();
              }).catch(function(err) {
                done.fail(err);
              });
            });
          });
        });
   
//        it('creates a new image record without documentation associated with an agent in the database', function(done) {
//          agent.populate('images', function(err, agent) {
//            if (err) done.fail(err);
//            expect(agent.images.length).toEqual(0);
//            browser
//              .select('album', 'Summer Memories')
//              .fill('title', 'Some great photo')
//              .fill('total', '$9.99')
//              .pressButton('Submit', function(err) {
//                if (err) done.fail(err);
//                browser.assert.success();
//                browser.assert.text('.alert', 'Image successfully submitted to ' + album.name);
//                models.Agent.findById(agent._id).populate('images').then(function(agent) {
//                  expect(agent.images.length).toEqual(1);
//                  done();
//                }).catch(function(err) {
//                  done.fail(err);
//                });
//              });
//            });
//        });
 
        it('creates a new image file record belonging to an image in the database', function(done) {
          models.ImageFile.count(function(err, count) {
            expect(count).toEqual(0);
            browser.select('album', 'Summer Memories');
            browser.fill('title', 'Some great photo');
            browser.attach('docs', 'spec/files/receipt.jpg');
            browser.pressButton('Submit', function(err) {
              if (err) done.fail(err);
              browser.assert.success();
              browser.assert.text('.alert', 'Image successfully submitted to ' + album.name);
              models.ImageFile.count(function(err, count) {
                expect(count).toEqual(1);
                models.Image.findOne({title: 'Some great photo'}, function(err, inv) {
                  expect(inv.files.length).toEqual(1);
                  done();
                });
              });
            });
          });
        });
  
        it('does not create a new image file record if no file provided', function(done) {
          models.ImageFile.count(function(err, count) {
            expect(count).toEqual(0);
            browser.select('album', 'Summer Memories');
            browser.fill('title', 'Some great photo');
            browser.pressButton('Submit', function(err) {
              if (!err) done.fail('There should be a 400 error here');
              browser.assert.status(400);
              browser.assert.text('.alert', 'No image provided');
              models.ImageFile.count(function(err, count) {
                expect(count).toEqual(0);
                models.Image.findOne({title: 'Some great photo'}, function(err, inv) {
                  if (err) done.fail(err);
                  expect(inv).toBeNull();
                  done();
                });
              });
            });
          });
        });
 
        it('creates a new image record with file associated with an album in the database', function(done) {
          album.populate('images', function(err, album) {
            if (err) done.fail(err);
            expect(album.images.length).toEqual(0);
            browser.select('album', 'Summer Memories');
            browser.fill('title', 'Some great photo');
            browser.attach('docs', 'spec/files/receipt.jpg');
            browser.pressButton('Submit', function(err) {
              if (err) done.fail(err);
              browser.assert.success();
              browser.assert.text('.alert', 'Image successfully submitted to ' + album.name);
              models.Album.findById(album._id).then(function(album) {
                expect(album.images.length).toEqual(1);
                done();
              }).catch(function(err) {
                done.fail(err);
              });
            });
          });
        });
 
//        it('creates a new image record without documentation associated with an album in the database', function(done) {
//          album.populate('images', function(err, album) {
//            if (err) done.fail(err);
//            expect(album.images.length).toEqual(0);
//            browser.select('album', 'Summer Memories');
//            browser.fill('title', 'Some great photo');
//            browser.fill('notes', 'super cool');
//            browser.pressButton('Submit', function(err) {
//              if (err) done.fail(err);
//              browser.assert.success();
//              browser.assert.text('.alert', 'Image successfully submitted to ' + album.name);
//              models.Album.findById(album._id).then(function(album) {
//                expect(album.images.length).toEqual(1);
//                done();
//              }).catch(function(err) {
//                done.fail(err);
//              });
//            });
//          });
//        });
 
        it('saves uploaded file to the right directory on the disk', function(done) {
          var date = new Date();
          var path = 'uploads/SummerMemories'  + '/' + date.getFullYear() + '/' + date.getMonth() + '/' + date.getDate()
          fs.readdir('/tmp', function(err, files) {
            if (err) done.fail(err);
            expect(files.length).toEqual(0);
   
            fs.readdir('uploads', function(err, files) {
              if (err) done.fail(err);
              expect(files.length).toEqual(0);
              browser.select('album', 'Summer Memories');
              browser.fill('title', 'Some great photo');
              browser.attach('docs', 'spec/files/receipt.jpg');
              browser.pressButton('Submit', function(err) {
                if (err) done.fail(err);
                fs.readdir('/tmp', function(err, files) {
                  if (err) done.fail(err);
                  expect(files.length).toEqual(0);
   
                  fs.readdir(path, function(err, files) {
                    if (err) done.fail(err);
                    expect(files.length).toEqual(1);
                    done();
                  });
                });
              });
            });
          });
        });
  
        it('displays the submitted (unapproved) image on the album page', function(done) {
          browser.assert.elements('.image', 0);
          browser.select('album', 'Summer Memories');
          browser.fill('title', 'Some great photo');
          browser.attach('docs', 'spec/files/receipt.jpg');
          browser.pressButton('Submit', function(err) {
            if (err) done.fail(err);
            browser.assert.url('/album');
            expect(browser.queryAll('.image.pending').length).toEqual(1);
            models.Image.findOne({ title: 'Some great photo' }).then(function(image) {
              expect(browser.queryAll('.image.pending a').length).toEqual(1);
              browser.assert.link('.image.pending a', image.title, '/image/' + image._id);
              done();
            }).catch(function(err) {
              done.fail(err);
            });
          });
        });

        it('displays images in descending order of when they were submitted', function(done) {
          models.Image.findOne({ agent: agent._id }).populate('album').then(function(inv1) {
            agent.images.push(inv1._id);
            models.Agent.findOneAndUpdate({ _id: agent._id }, agent, { new: true }).then(function(results) {
              browser.visit('/album', function(err) {
                if (err) done.fail(err);
                browser.assert.success();
                expect(browser.queryAll('.image a').length).toEqual(1);
                browser.assert.link('.image:nth-of-type(1) a', 'untitled', '/image/' + inv1._id);
                browser.select('album', 'Summer Memories');
                browser.fill('title', 'Some great photo')
                browser.attach('docs', 'spec/files/receipt.jpg')
                browser.pressButton('Submit', function(err) {
                  if (err) done.fail(err);
                  expect(browser.queryAll('.image.pending a').length).toEqual(2);
                  models.Image.findOne({ title: 'Some great photo' }).then(function(inv2) {
                    // Ensure both receipts have their album name displayed
                    var elemHtml = browser.html('.album');
                    // Three because the album name is listed in Submittable Albums section
                    expect(elemHtml.match(new RegExp(inv1.album.name, 'gi')).length).toEqual(3);
                    // 2016-11-24 https://github.com/assaf/zombie/issues/127
                    // cf., above block
                    //expect(browser.queryAll('.album', inv1.album.name).length).toEqual(2);
                    browser.assert.link('.image.pending:nth-of-type(1) a', inv2.title, '/image/' + inv2._id);
                    browser.assert.link('.image.pending:nth-of-type(2) a', 'untitled', '/image/' + inv1._id);
                    done();
                  }).catch(function(err) {
                    done.fail(err);
                  });
                });
              });
            }).catch(function(err) {
              done.fail(err);
            });
          }).catch(function(err) {
            done.fail(err);
          });
        });
      });
  
      describe('unsuccessful image submission', function() {
        beforeEach(function(done) {
          models.Album.findOne().then(function(results) {
            album = results;
            done();
          }).catch(function(err) {
            done.fail(err);
          });
        });

//        it('does not move the file if no title provided', function(done) {
//          fs.readdir('/tmp', function(err, files) {
//            if (err) done.fail(err);
//            expect(files.length).toEqual(0);
//   
//            fs.readdir('uploads', function(err, files) {
//              if (err) done.fail(err);
//              expect(files.length).toEqual(0);
//              browser.select('album', 'Summer Memories');
//              browser.attach('docs', 'spec/files/receipt.jpg')
//              browser.pressButton('Submit', function(err) {
//                expect(browser.status).toEqual(400);
//                fs.readdir('/tmp', function(err, files) {
//                  if (err) done.fail(err);
//                  expect(files.length).toEqual(1);
//                  fs.readdir('uploads', function(err, files) {
//                    if (err) done.fail(err);
//                    expect(files.length).toEqual(0);
//                    done();
//                  });
//                });
//              });
//            });
//          });
//        });
    
        it('returns 400 if no image file is provided', function(done) {
          browser.select('album', 'Summer Memories');
          browser.fill('title', 'Some great photo');
          browser.pressButton('Submit', function(err) {
            expect(browser.status).toEqual(400);
              done();
          });
        });

//        it('returns 400 if no file and junk is given as total price', function(done) {
//          browser
//            .select('album', 'Summer Memories')
//            .fill('title', 'Some great photo')
//            .fill('total', 'notcurrency')
//            .pressButton('Submit', function(err) {
//              expect(browser.status).toEqual(400);
//                done();
//            });
//        });
//  
        it('does not move the file if no album provided', function(done) {
          fs.readdir('/tmp', function(err, files) {
            if (err) done.fail(err);
            expect(files.length).toEqual(0);
   
            fs.readdir('uploads', function(err, files) {
              if (err) done.fail(err);
              expect(files.length).toEqual(0);

              request(app)
                .post('/image')
                .set('Cookie', browser.cookies)
                .field('album', '')
                .field('title', 'Awseome pic')
                .attach('docs', 'spec/files/receipt.jpg')
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(res.status).toEqual(400);
                  fs.readdir('/tmp', function(err, files) {
                    if (err) done.fail(err);
                    expect(files.length).toEqual(1);
                    fs.readdir('uploads', function(err, files) {
                      if (err) done.fail(err);
                      expect(files.length).toEqual(0);
                      done();
                    });
                  });
                });
            });
          });
        });

        it('does not allow a non-member agent to submit an image', function(done) {
          browser.clickLink('Logout', function(err) {
            browser.assert.success();
            expect(browser.query("a[href='/logout']")).toBeNull();
            browser.assert.attribute('form', 'action', '/login');
            models.Agent.findOne({ email: 'troy@example.com' }).then(function(troy) {
              // Reviewers can submit
              troy.reviewables = [];

              models.Agent.findByIdAndUpdate(troy._id, troy, {new: true}).then(function(troy) {
                expect(troy.reviewables.length).toEqual(0);
                expect(troy.submittables.length).toEqual(0);
 
                browser.fill('email', troy.email);
                browser.fill('password', 'topsecret');
                browser.pressButton('Login', function(err) {
                  if (err) done.fail(err);
                  browser.assert.success();

                  request(app)
                    .post('/image')
                    .set('Cookie', browser.cookies)
                    .field('album', album._id.toString())
                    .field('title', 'Legitimate business expense')
                    .attach('docs', 'spec/files/receipt.jpg')
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(res.status).toEqual(403);
                      done();
                    });
                  });
              }).catch(function(err) {
                done.fail(err);        
              });
            });
          });
        });
      });
    });
  });
});
