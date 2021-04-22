'use strict';

/**
 * `mock-fs` stubs the entire file system. So if a module hasn't
 * already been `require`d the tests will fail because the 
 * module doesn't exist in the mocked file system. `ejs` and
 * `iconv-lite/encodings` are required here to solve that 
 * problem.
 */
const fs = require('fs');
const mock = require('mock-fs');
const mockAndUnmock = require('../support/mockAndUnmock')(mock);

describe('Agent', function() {

  const _profile = require('../fixtures/sample-auth0-profile-response');

  const db = require('../../models');
  const Agent = db.Agent;

  let agent;
  beforeEach(done => {
    agent = new Agent(_profile);
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
  
    it('does not allow two identical emails', function(done) {
      agent.save().then(function(obj) {
        Agent.create(_profile).then(function(obj) {
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
      Agent.create({ ..._profile, email: ' ' }).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['email'].message).toEqual('No email supplied');
        done();
      });
    });

    it('does not allow an undefined email field', function(done) {
      Agent.create({}).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['email'].message).toEqual('No email supplied');
        done();
      });
    });

    it('saves the unstructured Auth0 data', done => {
      const profile = { ..._profile, email: 'someotherguy@example.com' };
      expect(Object.keys(profile).length).toEqual(15);
      Agent.create(profile).then(obj => {
        let asserted = false;
        for (let key in profile) {
          expect(obj[key]).toEqual(profile[key]);
          asserted = true;
        }
        expect(asserted).toBe(true);
        done();
      }).catch(error => {
        done.fail(error);
      });
    });

    /**
     * canRead relationship
     */
    describe('canRead', function() {
      let newAgent;
      beforeEach(function(done) {
        agent.save().then(function(obj) {
          new Agent({ ..._profile, email: 'anotherguy@example.com' }).save().then(obj => {
            newAgent = obj;
            done();
          }).catch(err => {
            done.fail(err);
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      // addToSet
      it('does not add a duplicate agent to the canRead set', function(done) {
        db.Agent.findByIdAndUpdate(agent._id, { $addToSet: { canRead: newAgent._id } }, { new: true, useFindAndModify: true }).then(function(agent) {
          expect(agent.canRead.length).toEqual(1);
          expect(agent.canRead[0]).toEqual(newAgent._id);

          db.Agent.findByIdAndUpdate(agent._id, { $addToSet: { canRead: newAgent._id } }, { new: true, useFindAndModify: true }).then(function(agent) {
            expect(agent.canRead.length).toEqual(1);
            expect(agent.canRead[0]).toEqual(newAgent._id);
            done();
          }).catch(err => {
            done.fail(err);
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      // addToSet
      it('allows two agents to add the same agent ID to the canRead set', function(done) {
        expect (agent.canRead.length).toEqual(0);
        expect (newAgent.canRead.length).toEqual(0);

        let viewableAgent = new Agent({ ..._profile, email: 'viewableAgent@example.com' });
        viewableAgent.save().then(function(result) {
          db.Agent.findByIdAndUpdate(agent._id, { $addToSet: { canRead: viewableAgent._id } }, { new: true, useFindAndModify: true }).then(function(agent) {
            db.Agent.findByIdAndUpdate(newAgent._id, { $addToSet: { canRead: viewableAgent._id } }, { new: true, useFindAndModify: true }).then(function(newAgent) {

              expect(agent.canRead.length).toEqual(1);
              expect(agent.canRead[0]).toEqual(viewableAgent._id);
              expect(newAgent.canRead.length).toEqual(1);
              expect(newAgent.canRead[0]).toEqual(viewableAgent._id);

              done();
            }).catch(err => {
              done.fail(err);
            });
          }).catch(err => {
            done.fail(err);
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      // addToSet
      it('allows two agents to add the same agent ID to the canRead set', function(done) {
        expect (agent.canRead.length).toEqual(0);
        expect (newAgent.canRead.length).toEqual(0);

        let viewableAgent = new Agent({ ..._profile, email: 'viewableAgent@example.com' });
        viewableAgent.save().then(function(result) {
          db.Agent.findByIdAndUpdate(agent._id, { $addToSet: { canRead: viewableAgent._id } }, { new: true, useFindAndModify: true }).then(function(agent) {
            db.Agent.findByIdAndUpdate(newAgent._id, { $addToSet: { canRead: viewableAgent._id } }, { new: true, useFindAndModify: true }).then(function(newAgent) {

              expect(agent.canRead.length).toEqual(1);
              expect(agent.canRead[0]).toEqual(viewableAgent._id);
              expect(newAgent.canRead.length).toEqual(1);
              expect(newAgent.canRead[0]).toEqual(viewableAgent._id);

              done();
            }).catch(err => {
              done.fail(err);
            });
          }).catch(err => {
            done.fail(err);
          });
        }).catch(err => {
          done.fail(err);
        });
      });
    });

    /**
     * #getReadables
     */
    describe('#getReadables', function() {
      let newAgent;
      beforeEach(function(done) {
        agent.save().then(function(obj) {
          new Agent({ ..._profile, email: 'anotherguy@example.com' }).save().then(function(obj) {
            newAgent = obj;
            agent.canRead.push(newAgent._id);
            agent.save().then(function(result) {
              done();
            }).catch(err => {
              done.fail(err);
            });
          }).catch(err => {
            done.fail(err);
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      it('retrieve an array containing accessible static directories', function(done) {
        agent.getReadables(function(err, readables) {
          if (err) {
            return done.fail(err);
          }
          expect(readables.length).toEqual(2);
          expect(readables[0]).toEqual(newAgent.getAgentDirectory());
          expect(readables[1]).toEqual(agent.getAgentDirectory());
          done();
        });
      });
    });

    /**
     * #getReadablesAndFiles
     */
    describe('#getReadablesAndFiles', function() {
      let newAgent;
      beforeEach(function(done) {
        agent.save().then(function(obj) {
          new Agent({ ..._profile, email: 'anotherguy@example.com' }).save().then(function(obj) {
            newAgent = obj;
            agent.canRead.push(newAgent._id);
            agent.save().then(function(result) {

              mockAndUnmock({ 
                [`uploads/${agent.getAgentDirectory()}/processed`]: {},
                [`uploads/${newAgent.getAgentDirectory()}`]: {
                  'image1.jpg': fs.readFileSync('spec/files/troll.jpg'),
                  'image2.jpg': fs.readFileSync('spec/files/troll.jpg'),
                  'image3.jpg': fs.readFileSync('spec/files/troll.jpg'),
                  'processed': {},
                  'archived': {},
                }
              });

              done();
            }).catch(err => {
              done.fail(err);
            });
          }).catch(err => {
            done.fail(err);
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      afterEach(() => {
        mock.restore();
      });

      it('retrieve an array containing accessible static directories and files', function(done) {
        agent.getReadablesAndFiles(function(err, readables) {
          if (err) {
            return done.fail(err);
          }
          expect(readables.length).toEqual(2);
          expect(readables[0].path).toEqual(newAgent.getAgentDirectory());
          expect(readables[0].files.length).toEqual(3);
          expect(readables[1].path).toEqual(agent.getAgentDirectory());
          expect(readables[1].files.length).toEqual(0);
          done();
        });
      });

      it('doesn\'t barf if readable agent doesn\'t have a directory yet', function(done) {
        new Agent({ ..._profile, email: 'brandnewagent@example.com' }).save().then(function(brandNewAgent) {
          agent.canRead.push(brandNewAgent._id);
          agent.save().then(function(result) {

            agent.getReadablesAndFiles(function(err, readables) {
              if (err) {
                return done.fail(err);
              }
              expect(readables.length).toEqual(3);
              expect(readables[0].path).toEqual(newAgent.getAgentDirectory());
              expect(readables[0].files.length).toEqual(3);
              expect(readables[1].path).toEqual(brandNewAgent.getAgentDirectory());
              expect(readables[1].files.length).toEqual(0);
              expect(readables[2].path).toEqual(agent.getAgentDirectory());
              expect(readables[2].files.length).toEqual(0);
              done();
            });
          }).catch(err => {
            done.fail(err);
          });
        }).catch(err => {
          done.fail(err);
        });
      });
    });

    /**
     * #getBaseFilename
     */
    describe('#getBaseFilename', function() {
      it('returns a filename in the proper Wycliffe-friendly format', () => {
        spyOn(Date, 'now').and.returnValue(Date.parse('02 Feb 2019 00:12:00 GMT'));

        expect(agent.name).toEqual('Some Guy');

        expect(agent.getBaseFilename()).toEqual('Guy, Some 2019 02 Feb Reimb Receipt');
      });

      it('handles prefixed zeroes on two-digit months', () => {
        spyOn(Date, 'now').and.returnValue(Date.parse('02 Dec 2019 00:12:00 GMT'));

        expect(agent.name).toEqual('Some Guy');

        expect(agent.getBaseFilename()).toEqual('Guy, Some 2019 12 Dec Reimb Receipt');
      });
    });

    /**
     * canWrite relationship
     *
     *
     * 2021-4-21 Why don't I have any tests here?
     */
//    describe('canWrite', function() {
//      let newAgent;
//      beforeEach(function(done) {
//        agent.save().then(function(obj) {
//          new Agent({..._profile, email: 'anotherguy@example.com' }).save().then(function(obj) {;
//            newAgent = obj;
//            done();
//          }).catch(err => {
//            done.fail(err);
//          });
//        }).catch(err => {
//          done.fail(err);
//        });
//      });
//    });

    /**
     * #getWritables
     */
    describe('#getWritables', function() {
      let newAgent;
      beforeEach(function(done) {

        agent.save().then(function(obj) {
          new Agent({ ..._profile, email: 'anotherguy@example.com' }).save().then(function(obj) {
            newAgent = obj;
            agent.canWrite.push(newAgent._id);
            agent.save().then(function(result) {
              done();
            }).catch(err => {
              done.fail(err);
            });
          }).catch(err => {
            done.fail(err);
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      it('retrieve an array containing writable static directories', function(done) {
        agent.getWritables(function(err, writables) {
          if (err) {
            return done.fail(err);
          }
          expect(writables.length).toEqual(2);
          expect(writables[0]).toEqual(newAgent.getAgentDirectory());
          expect(writables[1]).toEqual(agent.getAgentDirectory());
          done();
        });
      });
    });

    /**
     * #getWritablesAndFiles
     */
    describe('#getWritablesAndFiles', function() {
      let newAgent;
      beforeEach(function(done) {

        agent.save().then(function(obj) {
          new Agent({ ..._profile, email: 'anotherguy@example.com' }).save().then(function(obj) {
            newAgent = obj;
            agent.canWrite.push(newAgent._id);
            agent.save().then(function(result) {

              mockAndUnmock({ 
                [`uploads/${agent.getAgentDirectory()}/processed`]: {},
                [`uploads/${newAgent.getAgentDirectory()}`]: {
                  'image1.jpg': fs.readFileSync('spec/files/troll.jpg'),
                  'image2.jpg': fs.readFileSync('spec/files/troll.jpg'),
                  'image3.jpg': fs.readFileSync('spec/files/troll.jpg'),
                  'processed': {},
                  'archived': {},
                }
              });

              done();
            }).catch(err => {
              done.fail(err);
            });
          }).catch(err => {
            done.fail(err);
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      afterEach(() => {
        mock.restore();
      });

      it('retrieve an array containing writable static directories and files', function(done) {
        agent.getWritablesAndFiles(function(err, writables) {
          if (err) {
            return done.fail(err);
          }
          expect(writables.length).toEqual(2);
          expect(writables[0].path).toEqual(newAgent.getAgentDirectory());
          expect(writables[0].files.length).toEqual(3);
          expect(writables[1].path).toEqual(agent.getAgentDirectory());
          expect(writables[1].files.length).toEqual(0);
          done();
        });
      });

      it('doesn\'t barf if writable agent doesn\'t have a directory yet', function(done) {
        new Agent({ email: 'brandnewagent@example.com', password: 'secret', name: 'Brand New Agent' }).save().then(function(brandNewAgent) {
          agent.canWrite.push(brandNewAgent._id);
          agent.save().then(function(result) {

            agent.getWritablesAndFiles(function(err, writables) {
              if (err) {
                return done.fail(err);
              }
              expect(writables.length).toEqual(3);
              expect(writables[0].path).toEqual(newAgent.getAgentDirectory());
              expect(writables[0].files.length).toEqual(3);
              expect(writables[1].path).toEqual(brandNewAgent.getAgentDirectory());
              expect(writables[1].files.length).toEqual(0);
              expect(writables[2].path).toEqual(agent.getAgentDirectory());
              expect(writables[2].files.length).toEqual(0);
              done();
            });
          }).catch(err => {
            done.fail(err);
          });
        }).catch(err => {
          done.fail(err);
        });
      });
    });
  });
});
