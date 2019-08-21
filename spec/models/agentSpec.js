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
  const db = require('../../models');
  const Agent = db.Agent;

  let agent;

  const _valid = {};
  beforeEach(function(done) {
    _valid.name = 'Some Guy';
    _valid.email = 'someguy@example.com';
    _valid.password = 'secret';

    agent = new Agent(_valid);
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
    const valid = {};
    beforeEach(function(done) {
        done();
    });

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
        Agent.create(_valid).then(function(obj) {
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
      _valid.email = '    ';
      Agent.create(_valid).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['email'].message).toEqual('No email supplied');
        done();
      });
    });

    it('does not allow an undefined email field', function(done) {
      delete _valid.email;
      Agent.create(_valid).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['email'].message).toEqual('No email supplied');
        done();
      });
    });

    it('does not allow an empty password field', function(done) {
      _valid.password = '    ';
      Agent.create(_valid).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['password'].message).toEqual('No password supplied');
        done();
      });
    });

    it('does not allow an undefined password field', function(done) {
      delete _valid.password;
      Agent.create(_valid).then(function(obj) {
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

    it('does not allow an empty name field', function(done) {
      _valid.name = '      ';
      Agent.create(_valid).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['name'].message).toEqual('No name supplied');
        done();
      });
    });

    it('does not allow an undefined name field', function(done) {
      delete _valid.name;
      Agent.create(_valid).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['name'].message).toEqual('No name supplied');
        done();
      });
    });

    /**
     * canRead relationship
     */
    describe('canRead', function() {
      let newAgent;
      beforeEach(function(done) {
        agent.save().then(function(obj) {
          new Agent({ email: 'anotherguy@example.com', password: 'secret', name: 'Another Guy' }).save().then(function(obj) {;
            newAgent = obj;
            done();
          }).catch(err => {
            done.fail(err);
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      it('does not add a duplicate agent to the canRead field', function(done) {
        agent.canRead.push(newAgent._id);
        agent.save().then(function(result) {
          expect(agent.canRead.length).toEqual(1);
          expect(agent.canRead[0]).toEqual(newAgent._id);

          agent.canRead.push(newAgent._id);
          agent.save().then(function(result) {
            done.fail('This should not have updated');
          }).catch(err => {
            expect(err.message).toMatch('Duplicate values in array');
            done();
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      it('allows two agents to push the same agent ID', function(done) {
        expect (agent.canRead.length).toEqual(0);
        expect (newAgent.canRead.length).toEqual(0);

        let viewableAgent = new Agent({ email: 'viewableAgent@example.com', password: 'secret', name: 'Viewable Agent' });
        viewableAgent.save().then(function(result) {
        
          agent.canRead.push(viewableAgent._id);
          newAgent.canRead.push(viewableAgent._id);

          agent.save().then(function(result) {
            expect(agent.canRead.length).toEqual(1);
            expect(agent.canRead[0]).toEqual(viewableAgent._id);
  
            newAgent.save().then(function(result) {
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
          new Agent({ email: 'anotherguy@example.com', password: 'secret', name: 'Another Guy' }).save().then(function(obj) {
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
          new Agent({ email: 'anotherguy@example.com', password: 'secret', name: 'Another Guy' }).save().then(function(obj) {
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
        new Agent({ email: 'brandnewagent@example.com', password: 'secret', name: 'Brand New Agent' }).save().then(function(brandNewAgent) {
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

    /**
     * .getAgentDirectory
     */
    describe('.getAgentDirectory', function() {
      it('returns a directory path based on the agent\'s email address', () => {
        expect(agent.email).toEqual('someguy@example.com');
        expect(agent.getAgentDirectory()).toEqual('example.com/someguy');
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
     */
    describe('canWrite', function() {
      let newAgent;
      beforeEach(function(done) {
        agent.save().then(function(obj) {
          new Agent({ email: 'anotherguy@example.com', password: 'secret', name: 'Another Guy' }).save().then(function(obj) {;
            newAgent = obj;
            done();
          }).catch(err => {
            done.fail(err);
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      it('does not add a duplicate agent to the canWrite field', function(done) {
        agent.canWrite.push(newAgent._id);
        agent.save().then(function(result) {
          expect(agent.canWrite.length).toEqual(1);
          expect(agent.canWrite[0]).toEqual(newAgent._id);

          agent.canWrite.push(newAgent._id);
          agent.save().then(function(result) {
            done.fail('This should not have updated');
          }).catch(err => {
            expect(err.message).toMatch('Duplicate values in array');
            done();
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      it('allows two agents to push the same writeable agent ID', function(done) {
        expect (agent.canWrite.length).toEqual(0);
        expect (newAgent.canWrite.length).toEqual(0);

        let writeableAgent = new Agent({ email: 'writeableAgent@example.com', password: 'secret', name: 'Writable Agent' });
        writeableAgent.save().then(function(result) {
        
          agent.canWrite.push(writeableAgent._id);
          newAgent.canWrite.push(writeableAgent._id);

          agent.save().then(function(result) {
            expect(agent.canWrite.length).toEqual(1);
            expect(agent.canWrite[0]).toEqual(writeableAgent._id);
  
            newAgent.save().then(function(result) {
              expect(newAgent.canWrite.length).toEqual(1);
              expect(newAgent.canWrite[0]).toEqual(writeableAgent._id);
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
  });
});
