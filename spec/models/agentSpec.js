'use strict';

describe('Agent', function() {
  const fixtures = require('pow-mongoose-fixtures');
  const db = require('../../models');
  const Agent = db.Agent;

  var agent;

  beforeEach(function(done) {
    agent = new Agent({ email: 'someguy@example.com', password: 'secret' });
    done();
  });

  afterEach(function(done) {
    db.mongoose.connection.db.dropDatabase().then(function(result) {
      done();
    }).catch(function(err) {
      done.fail(err);         
    });
  });
 
  describe('basic validation', function() {
    it('sets the createdAt and updatedAt fields', function(done) {
      expect(agent.createdAt).toBe(undefined);
      expect(agent.updatedAt).toBe(undefined);
      agent.save().then(function(obj) {
        expect(agent.createdAt instanceof Date).toBe(true);
        expect(agent.updatedAt instanceof Date).toBe(true);
        done();
      }).catch(err => {
        done.fail(err);
      });
    });
  
    it("encrypts the agent's password", function(done) {
      expect(agent.password).toEqual('secret');
      agent.save().then(function(obj) {
        Agent.findById(obj._id).then(function(results) {
          expect(results.password).not.toEqual('secret');
          done();
        }).catch(err => {
          done.fail(err);
        });
      }).catch(err => {
        done.fail(err);
      });
    });

    it('does not allow two identical emails', function(done) {
      agent.save().then(function(obj) {
        Agent.create({ email: 'someguy@example.com', password: 'secret' }).then(function(obj) {
          done.fail('This should not have saved');
        }).catch(function(error) {
          expect(Object.keys(error.errors).length).toEqual(1);
          expect(error.errors['email'].message).toEqual('That email is already registered');
          done();
        });
      }).catch(function(error) {
        done.fail(error);
      });
    });

    it('does not allow an empty email field', function(done) {
      Agent.create({ email: ' ', password: 'secret' }).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['email'].message).toEqual('No email supplied');
        done();
      });
    });

    it('does not allow an undefined email field', function(done) {
      Agent.create({ password: 'secret' }).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['email'].message).toEqual('No email supplied');
        done();
      });
    });

    it('does not allow an empty password field', function(done) {
      Agent.create({ email: 'someguy@example.com', password: '   ' }).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['password'].message).toEqual('No password supplied');
        done();
      });
    });

    it('does not allow an undefined password field', function(done) {
      Agent.create({ email: 'someguy@example.com' }).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['password'].message).toEqual('No password supplied');
        done();
      });
    });

    it('does not re-hash a password on update', function(done) {
      agent.save().then(function(obj) {
        var passwordHash = agent.password;
        agent.email = 'newemail@example.com';
        agent.save().then(function(obj) {
          expect(agent.password).toEqual(passwordHash); 
          done();
        });
      });
    });

    /**
     * .validPassword
     */
    describe('.validPassword', function() {
      beforeEach(function(done) {
        agent.save().then(function(obj) {
          done();
        });
      });

      it('returns true if the password is a match', function(done) {
        Agent.validPassword('secret', agent.password, function(err, res) {
          expect(res).toEqual(agent);
          done();
        }, agent);
      });

      it('returns false if the password is not a match', function(done) {
        Agent.validPassword('wrongsecretpassword', agent.password, function(err, res) {
          expect(res).toBe(false);
          done();
        }, agent);
      });
    });
  });

  /**
   * Document relationships
   */
  describe('relationships', function() {
    var album;

    beforeEach(function(done) {
      fixtures.load(__dirname + '/../fixtures/albums.js', db.mongoose, function(err) {
        if (err) done.fail(err);
        db.Album.findOne().then(function(results) {
          album = results;
          done();
        }).catch(function(error) {
          done.fail(error);
        });
      });
    });

    it('includes having many images', function(done) {
      agent.save().then(function() {
        db.Image.create({ title: 'Buy beer', agent: agent._id, album: album._id }).then(function(t1) {
          expect(agent.images.length).toEqual(0);
          agent.images.push(t1);
          agent.update().then(function() {
            expect(agent.images.length).toEqual(1);
            agent.populate('images', function(err, acct) {
              if (err) done.fail(err);
              expect(agent.images[0].title).toEqual(t1.title);

               // Add another image
              db.Image.create({ title: 'Sell doodad', agent: agent._id, album: album._id }).then(function(t2) {
                expect(agent.images.length).toEqual(1);
                agent.images.push(t2);
                agent.update().then(function() {
                  expect(agent.images.length).toEqual(2);
                  agent.populate('images', function(err, acct) {
                    if (err) done.fail(err);
                      expect(agent.images[0].title).toEqual(t1.title);
                      expect(agent.images[1].title).toEqual(t2.title);
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

    it('includes having many reviewables', function(done) {
      agent.save().then(function() {
        db.Album.create({ name: 'Tupperware' }).then(function(a1) {
          expect(agent.reviewables.length).toEqual(0);
          agent.reviewables.push(a1);
          agent.update().then(function() {
            expect(agent.reviewables.length).toEqual(1);
            agent.populate('reviewables', function(err, agnt) {
              if (err) done.fail(err);
              expect(agent.reviewables[0].name).toEqual(a1.name);

              // Add another image
              db.Album.create({ name: 'Avon' }).then(function(a2) {
                expect(agent.reviewables.length).toEqual(1);
                agent.reviewables.push(a2);
                agent.update().then(function() {
                  expect(agent.reviewables.length).toEqual(2);
                  agent.populate('reviewables', function(err, agnt) {
                    if (err) done.fail(err);
                    expect(agent.reviewables[0].name).toEqual(a1.name);
                    expect(agent.reviewables[1].name).toEqual(a2.name);
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

    it('includes having many viewables', function(done) {
      agent.save().then(function() {
        db.Album.create({ name: 'Tupperware' }).then(function(a1) {
          expect(agent.viewables.length).toEqual(0);
          agent.viewables.push(a1);
          agent.update().then(function() {
            expect(agent.viewables.length).toEqual(1);
            agent.populate('viewables', function(err, agnt) {
              if (err) done.fail(err);
              expect(agent.viewables[0].name).toEqual(a1.name);

              // Add another image
              db.Album.create({ name: 'Avon' }).then(function(a2) {
                expect(agent.viewables.length).toEqual(1);
                agent.viewables.push(a2);
                agent.update().then(function() {
                  expect(agent.viewables.length).toEqual(2);
                  agent.populate('viewables', function(err, agnt) {
                    if (err) done.fail(err);
                    expect(agent.viewables[0].name).toEqual(a1.name);
                    expect(agent.viewables[1].name).toEqual(a2.name);
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


    it('includes having many submittables', function(done) {
      agent.save().then(function() {
        db.Album.create({ name: 'Tupperware' }).then(function(a1) {
          expect(agent.submittables.length).toEqual(0);
          agent.submittables.push(a1);
          agent.update().then(function() {
            expect(agent.submittables.length).toEqual(1);
            agent.populate('submittables', function(err, agnt) {
              if (err) done.fail(err);
              expect(agent.submittables[0].name).toEqual(a1.name);

              // Add another image
              db.Album.create({ name: 'Avon' }).then(function(a2) {
                expect(agent.submittables.length).toEqual(1);
                agent.submittables.push(a2);
                agent.update().then(function() {
                  expect(agent.submittables.length).toEqual(2);
                  agent.populate('submittables', function(err, agnt) {
                    if (err) done.fail(err);
                    expect(agent.submittables[0].name).toEqual(a1.name);
                    expect(agent.submittables[1].name).toEqual(a2.name);
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
});
