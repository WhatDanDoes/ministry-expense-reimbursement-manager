'use strict';

describe('Album', function() {
  const fixtures = require('pow-mongoose-fixtures');

  var db = require('../../models');
  var Album = db.Album;

  var album;

  beforeEach(function(done) {
    album = new Album({ name: 'Little Feet' });
    done();
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
      expect(album.createdAt).toBe(undefined);
      expect(album.updatedAt).toBe(undefined);
      album.save().then(function(obj) {
        expect(album.createdAt instanceof Date).toBe(true);
        expect(album.updatedAt instanceof Date).toBe(true);
        done();
      }).catch(function(error) {
        done.fail(error);
      });
    });
  
    it('does not allow two identical album names', function(done) {
      album.save().then(function(obj) {
        Album.create({ name: 'Little Feet' }).then(function(obj) {
          done.fail('This should not have saved');
        }).catch(function(error) {
          expect(Object.keys(error.errors).length).toEqual(1);
          expect(error.errors['name'].message).toEqual('That album name is taken');
          done();
        });
      }).catch(function(error) {
        done.fail(error);
      });
    });

    it('does not allow an empty name field', function(done) {
      Album.create({ name: ' ' }).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['name'].message).toEqual('No album name supplied');
        done();
      });
    });

    it('does not allow an undefined name field', function(done) {
      Album.create({ }).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['name'].message).toEqual('No album name supplied');
        done();
      });
    });
  });


  /**
   * Document relationships
   */
  describe('relationships', function() {
    var agent;

    beforeEach(function(done) {
      fixtures.load(__dirname + '/../fixtures/agents.js', db.mongoose, function(err) {
        if (err) done.fail(err);
        db.Agent.findOne().then(function(results) {
          agent = results;
          done();
        }).catch(function(err) {
          done.fail(err);
        });
      });
    });

    it('includes having many images', function(done) {
      album.save().then(function() {
        db.Image.create({ title: 'Buy beer', album: album._id, agent: agent._id }).then(function(t1) {
          expect(album.images.length).toEqual(0);
          album.images.push(t1);
          album.update().then(function() {
            expect(album.images.length).toEqual(1);
            album.populate('images', function(err, acct) {
              if (err) done.fail(err);
              expect(album.images[0].title).toEqual(t1.title);

              // Add another image
              db.Image.create({ title: 'Sell doodad', album: album._id, agent: agent._id }).then(function(t2) {
                expect(album.images.length).toEqual(1);
                  album.images.push(t2);
                  album.update().then(function() {
                    expect(album.images.length).toEqual(2);
                    album.populate('images', function(err, acct) {
                      if (err) done.fail(err);
                      expect(album.images[0].title).toEqual(t1.title);
                      expect(album.images[1].title).toEqual(t2.title);
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

    it('includes having many reviewers', function(done) {
      album.save().then(function() {
        expect(album.reviewers.length).toEqual(0);
        album.reviewers.push(agent);
        album.update().then(function() {
          expect(album.reviewers.length).toEqual(1);
          album.populate('reviewers', function(err, acct) {
            if (err) done.fail(err);
            expect(album.reviewers[0].email).toEqual(agent.email);

            // Add another reviewer
            db.Agent.create({ email: 'someguy@example.com', password: 'secret' }).then(function(a1) {
              expect(album.reviewers.length).toEqual(1);
              album.reviewers.push(a1);
              album.update().then(function() {
                expect(album.reviewers.length).toEqual(2);
                album.populate('reviewers', function(err, acct) {
                  if (err) done.fail(err);
                  expect(album.reviewers[0].email).toEqual(agent.email);
                  expect(album.reviewers[1].email).toEqual(a1.email);
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
    });

    it('includes having many viewers', function(done) {
      album.save().then(function() {
        expect(album.viewers.length).toEqual(0);
        album.viewers.push(agent);
        album.update().then(function() {
          expect(album.viewers.length).toEqual(1);
          album.populate('viewers', function(err, acct) {
            if (err) done.fail(err);
            expect(album.viewers[0].email).toEqual(agent.email);

            // Add another viewer
            db.Agent.create({ email: 'someguy@example.com', password: 'secret' }).then(function(a1) {
              expect(album.viewers.length).toEqual(1);
              album.viewers.push(a1);
              album.update().then(function() {
                expect(album.viewers.length).toEqual(2);
                album.populate('viewers', function(err, acct) {
                  if (err) done.fail(err);
                  expect(album.viewers[0].email).toEqual(agent.email);
                  expect(album.viewers[1].email).toEqual(a1.email);
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
    });

    it('includes having many submitters', function(done) {
      album.save().then(function() {
        expect(album.submitters.length).toEqual(0);
        album.submitters.push(agent);
        album.update().then(function() {
          expect(album.submitters.length).toEqual(1);
          album.populate('submitters', function(err, acct) {
            if (err) done.fail(err);
            expect(album.submitters[0].email).toEqual(agent.email);

            // Add another submitter
            db.Agent.create({ email: 'someguy@example.com', password: 'secret' }).then(function(a1) {
              expect(album.submitters.length).toEqual(1);
              album.submitters.push(a1);
              album.update().then(function() {
                expect(album.submitters.length).toEqual(2);
                album.populate('submitters', function(err, acct) {
                  if (err) done.fail(err);
                  expect(album.submitters[0].email).toEqual(agent.email);
                  expect(album.submitters[1].email).toEqual(a1.email);
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
    });
  });
});
