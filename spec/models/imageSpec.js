'use strict';
const fs = require('fs'); 
const mock = require('mock-fs');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe('Image', function() {
  const fixtures = require('pow-mongoose-fixtures');
  
  const db = require('../../models');
  const Image = db.Image;

  var image, basicImage, album, agent;

  beforeEach(function(done) {
    fixtures.load(__dirname + '/../fixtures/agents.js', db.mongoose, function(err) {
      if (err) done.fail(err);
      db.Agent.findOne().then(function(results) {
        agent = results;
        fixtures.load(__dirname + '/../fixtures/albums.js', db.mongoose, function(err) {
          if (err) done.fail(err);
 
          db.Album.findOne().then(function(results) {
            album = results;

            basicImage = {
              title: 'Beer',
              total: '-14.50',
              album: album._id,
              agent: agent._id
            };
      
            image = new Image(basicImage);
 
            done();
          }).catch(function(error) {
            done.fail(error);
          }); // Album find 
        }); // Album fixtures 
      }).catch(function(error) {
        done.fail(error);
      }); // Agent find
    }); // Agent fixtures
  });

  afterEach(function(done) {
    db.mongoose.connection.db.dropDatabase().then(function(err, result) {
      done();
    }).catch(function(err) {
      done.fail(err);         
    });
  });
 
  describe('basic validation', function() {
    it('sets the createdAt and updatedAt fields', function(done) {
      expect(image.createdAt).toBe(undefined);
      expect(image.updatedAt).toBe(undefined);
      image.save().then(function(obj) {
        expect(image.createdAt instanceof Date).toBe(true);
        expect(image.updatedAt instanceof Date).toBe(true);
        done();
      }).catch(function(error) {
        done.fail(error);
      });
    });

    it('sets the date at which the event took place if not set explicitly', function(done) {
      var date = image.tookPlaceAt; 
      image.save().then(function(obj) {
        expect(obj.tookPlaceAt instanceof Date).toBe(true);
        expect(obj.tookPlaceAt).toEqual(date);
        done();
      });
    }); 

    it('sets the date at which the event took place', function(done) {
      var date = new Date(1978, 8, 8);
      image.tookPlaceAt = date;
      image.save().then(function(obj) {
        expect(obj.tookPlaceAt instanceof Date).toBe(true);
        expect(obj.tookPlaceAt).toEqual(date);
        done();
      }).catch(function(error) {
        done.fail(error);
      });
    }); 

    it('trims the title if provided', function(done) {
      var title = '     Some awesome image  ';
      basicImage.title = title;
      Image.create(basicImage).then(function(obj) {
        expect(obj.title).not.toEqual(title);
        expect(obj.title).toEqual(title.trim());
        done();
      }).catch(function(error) {
        done.fail(error);
      });
    });

    it('must be associated with an album', (done) => {
      delete basicImage.album;
      Image.create(basicImage).then((obj) => {
        done.fail('This should not have saved');
      }).catch((error) => {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['album'].message).toEqual('This image is not associated with an album');
        done();
      });
    });

    it('must be associated with an agent', function(done) {
      delete basicImage.agent;
      Image.create(basicImage).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['agent'].message).toEqual('This image is not associated with an agent');
        done();
      });
    });

    it('trims the notes if provided', function(done) {
      var notes = '     Entertaining clients  ';
      basicImage.notes = notes;
      Image.create(basicImage).then(function(obj) {
        expect(obj.notes).not.toEqual(notes);
        expect(obj.notes).toEqual(notes.trim());
        done();
      }).catch(function(error) {
        done.fail(error);
      });
    });

    it("sets the 'approved' property to false", function(done) {
      Image.create(basicImage).then(function(obj) {
        expect(obj.approved).toBe(false);
        done();
      }).catch(function(error) {
        done.fail(error);
      });
    });
  });

  /**
   * Toggle approved property
   */
  describe('#review', function() {
    it('sets the approved field to true if set to false', function(done) {
      expect(image.approved).toBe(false);
      image.review(function(err) {
        if (err) done.fail(err);
        expect(image.approved).toBe(true);
        done();
      });
    });

    it('sets the approved field to false if set to true', function(done) {
      image.approved = true;
      expect(image.approved).toBe(true);
      image.review(function(err) {
        if (err) done.fail(err);
        expect(image.approved).toBe(false);
        done();
      });
    });
  });

  /**
   * Document relationships
   */
  describe('relationships', function() {
    beforeEach(function(done) {

      basicImage = {
        title: 'Beer',
        album: album._id,
        agent: agent._id
      };

      image = new Image(basicImage);
      done();
    });

    it('belongs to an album', function(done) {
      image.album = undefined;
      image.save().then(function(trans) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        image.album = album._id;
        image.save().then(function(trans) {
          expect(image.album).toBeDefined();
          image.populate('album', function(err, t1) {
            if (err) done.fail(err);
            expect(image.album.name).toEqual(album.name);
            album.images.push(image);
            album.populate('images', function(err) {
              if (err) done.fail(err);
              expect(album.images.length).toEqual(1);
              expect(album.images[0].title).toEqual(image.title);
              done();
            });
          });
        }).catch(function(error) {
          done.fail(error);
        });
      });
    });

    it('belongs to an agent', function(done) {
      image.agent = undefined;
      image.save().then(function(trans) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        image.agent = agent._id;
        image.save().then(function(trans) {
          expect(image.agent).toBeDefined();
          image.populate('agent', function(err, t1) {
            if (err) done.fail(err);
            expect(image.agent.email).toEqual(agent.email);
            agent.images.push(image);
            agent.populate('images', function(err) {
              if (err) done.fail(err);
              expect(agent.images.length).toEqual(1);
              expect(agent.images[0].title).toEqual(image.title);
              done();
            });
          });
        }).catch(function(error) {
          done.fail(error);
        });
      });
    });

    it('includes having many files', function(done) {
      mock({
        '/tmp/fake.pdf': 'file content here',
        '/tmp/anotherFake.pdf': 'More file content here',
        'uploads': { /* empty directory */ }
      });
      image.save().then(function() {
        expect(image.files.length).toEqual(0);
        db.ImageFile.create({ path:'/tmp/fake.pdf', image: image._id }).then(function(i1) {
          image.files.push(i1);
          image.update().then(function() {
            expect(image.files.length).toEqual(1);
            image.populate('files', function(err, inv) {
              if (err) done.fail(err);
              expect(image.files[0].path).toEqual(i1.path);

              // Add another image
              db.ImageFile.create({ path: '/tmp/anotherFake.pdf', image: image._id }).then(function(i2) {
                image.files.push(i2);
                image.update().then(function() {
                  expect(image.files.length).toEqual(2);
                    image.populate('files', function(err, inv) {
                      if (err) done.fail(err);
                      expect(image.files[0].path).toEqual(i1.path);
                      expect(image.files[1].path).toEqual(i2.path);
                      mock.restore();
                      done();
                    });
                }).catch(function(error) {
                  done.fail(error);
                });
              }).catch(function(error) {
                done.fail(error);
              });
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

  describe('remove hook', function() {
    beforeEach(function(done) {
      mock({
        '/tmp/fake.pdf': 'file content here',
        '/tmp/anotherFake.pdf': 'More file content here',
        'uploads': { /* empty directory */ }
      });
      image.save().then(function() {
        expect(image.files.length).toEqual(0);
        db.ImageFile.create({ path:'/tmp/fake.pdf', image: image._id }).then(function(i1) {
          image.files.push(i1);
          image.update().then(function() {
            expect(image.files.length).toEqual(1);
            image.populate('files', function(err, inv) {
              if (err) done.fail(err);
              expect(image.files[0].path).toEqual(i1.path);

              // Add another image
              db.ImageFile.create({ path: '/tmp/anotherFake.pdf', image: image._id }).then(function(i2) {
                image.files.push(i2);
                image.update().then(function() {
                  expect(image.files.length).toEqual(2);
                    image.populate('files', function(err, inv) {
                      if (err) done.fail(err);
                      expect(image.files[0].path).toEqual(i1.path);
                      expect(image.files[1].path).toEqual(i2.path);
                      done();
                    });
                }).catch(function(error) {
                  done.fail(error);
                });
              }).catch(function(error) {
                done.fail(error);
              });
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

    afterEach(function(done) {
      mock.restore();
      done();
    });

    it('removes files associated with an image', function(done) {
      expect(image.files.length).toEqual(2);
      db.ImageFile.find({ image: image._id }).then(function(files) {
        expect(files.length).toEqual(2);
        expect(fs.statSync(files[0].path).isFile()).toBe(true);
        expect(fs.statSync(files[1].path).isFile()).toBe(true);
        image.remove().then(function(results) {
          db.ImageFile.find({ image: image._id }).then(function(results) {
            expect(results.length).toEqual(0);
            fs.access(files[0].path, function(err) {
              expect(err.message).toEqual("ENOENT, no such file or directory '" + files[0].path + "'");
              fs.access(files[1].path, function(err) {
                expect(err.message).toEqual("ENOENT, no such file or directory '" + files[1].path + "'");
                done();
              });
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
});
