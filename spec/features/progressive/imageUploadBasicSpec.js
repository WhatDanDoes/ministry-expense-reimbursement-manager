const fs = require('fs');
const fixtures = require('pow-mongoose-fixtures');

const app = require('../../../app');
const models = require('../../../models');

const mock = require('mock-fs');
const mockAndUnmock = require('../../support/mockAndUnmock')(mock);

const jwt = require('jsonwebtoken');

// For browser tests
const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const DOMAIN = 'example.com';
Browser.localhost(DOMAIN, PORT);

const stubAuth0Sessions = require('../../support/stubAuth0Sessions');

describe('image upload basic', () => {

  let agent, token;

  beforeEach(done => {
    fixtures.load(__dirname + '/../../fixtures/agents.js', models.mongoose, function(err) {
      if (err) {
        return done.fail(err);
      }
      models.Agent.findOne({ email: 'daniel@example.com' }).then(function(results) {
        agent = results;
        token = jwt.sign({ email: agent.email }, process.env.SECRET, { expiresIn: '1h' });

        // Stubbing way up here because required files get mocked out otherwise
        stubAuth0Sessions(agent.email, DOMAIN, err => {
          if (err) done.fail(err);

          mockAndUnmock({
            'uploads': mock.directory({}),
          });

          done();
        });

      }).catch(error => {
        done.fail(error);
      });
    });
  });

  afterEach(done => {
    mock.restore();
    models.mongoose.connection.db.dropDatabase().then(result => {
      done();
    }).catch(err => {
      done.fail(err);
    });
  });

  describe('browser', () => {
    let browser, lanny;

    beforeEach(done => {

      browser = new Browser({ waitDuration: '30s', loadCss: false });
      //browser.debug();

      models.Agent.findOne({ email: 'lanny@example.com' }).then(results => {
        lanny = results;
        browser.visit('/', err => {
          if (err) return done.fail(err);
          browser.assert.success();

          browser.clickLink('Login', err => {
            if (err) return done.fail(err);
            browser.assert.success();
            browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}` });
            done();
          });
        });
      }).catch(error => {
        done.fail(error);
      });
    });

    describe('unauthenticated access', () => {
      beforeEach(done => {
        // Expire all sessions
        models.db.collection('sessions').updateMany({}, { $currentDate: {expires: true} }).then(result => {
          done();
        }).catch(err => {
          done.fail(err);
        });
      });

      it('redirects home with a friendly error message', done => {
        // Attaching a file fires the `submit` event. No need to click anything
        browser.attach('docs', 'spec/files/troll.jpg').then(res => {
          browser.assert.redirected();
          browser.assert.url({ pathname: '/' });
          browser.assert.text('.alert.alert-danger', 'You need to login first');
          done();
        }).catch(err => {
          done.fail(err);
        });
      });

      it('does not write a file to the file system', done => {
        fs.readdir(`uploads/${agent.getAgentDirectory()}`, (err, files) => {
          if (err) {
            return done.fail(err);
          }
          expect(files.length).toEqual(0);

          browser.attach('docs', 'spec/files/troll.jpg').then(res => {
            fs.readdir(`uploads/${agent.getAgentDirectory()}`, (err, files) => {
              if (err) {
                return done.fail(err);
              }
              expect(files.length).toEqual(0);
              done();
            });
          });
        });
      });

      it('does not create a database record', done => {
        models.Invoice.find({}).then(invoices => {
          expect(invoices.length).toEqual(0);
          browser.attach('docs', 'spec/files/troll.jpg').then(res => {
            models.Invoice.find({}).then(invoices => {
              expect(invoices.length).toEqual(0);
              done();
            }).catch(err => {
              done.fail(err);
            });
          });
        }).catch(err => {
          done.fail(err);
        });
      });
    });

    describe('authenticated access', () => {
      it('displays a friendly message upon successful receipt of file', done => {
        browser.attach('docs', 'spec/files/troll.jpg').then(res => {
          browser.assert.redirected();
          browser.assert.url({ pathname: `/image/${agent.getAgentDirectory()}` });
          browser.assert.text('.alert.alert-success', 'Invoice received');
          done();
        }).catch(err => {
          done.fail(err);
        });
      });

      it('writes the file to the disk on agent\'s first access', done => {
        fs.readdir(`uploads/${agent.getAgentDirectory()}`, (err, files) => {
          if (err) {
            return done.fail(err);
          }
          expect(files.length).toEqual(0);

          browser.attach('docs', 'spec/files/troll.jpg').then(res => {

            fs.readdir(`uploads/${agent.getAgentDirectory()}`, (err, files) => {

              if (err) {
                return done.fail(err);
              }
              expect(files.length).toEqual(1);

              done();
            });
          }).catch(err => {
            done.fail(err);
          });
        });
      });

      // 2021-2-22
      //
      // This actually meant to test multiple file uploads in one action.
      // Currently attaching a file to the `input` triggers an immediate
      // `submit`, which makes attaching more than one file impossible.
      //
      // Noted here so that it can be revisited as progressive app features
      // continue to take shape
      //
      it('writes multiple attached files to disk', done => {

        fs.readdir(`uploads/${agent.getAgentDirectory()}`, (err, files) => {
          if (err) {
            return done.fail(err);
          }
          expect(files.length).toEqual(0);

          browser.attach('docs', 'spec/files/troll.jpg').then(res => {

            fs.readdir(`uploads/${agent.getAgentDirectory()}`, (err, files) => {

              if (err) {
                return done.fail(err);
              }
              expect(files.length).toEqual(1);

              browser.attach('docs', 'spec/files/troll.png').then(res => {

                fs.readdir(`uploads/${agent.getAgentDirectory()}`, (err, files) => {

                  if (err) {
                    return done.fail(err);
                  }
                  expect(files.length).toEqual(2);

                  done();
                });
              }).catch(err => {
                done.fail(err);
              });
            });
          }).catch(err => {
            done.fail(err);
          });
        });
      });

//      it('creates a database record', done => {
//        models.Invoice.find({}).then(invoices => {
//          expect(invoices.length).toEqual(0);
//
//          browser.attach('docs', 'spec/files/troll.png').then(res => {
//            models.Invoice.find({}).then(invoices => {
//              expect(invoices.length).toEqual(1);
//              expect(invoices[0].path).toMatch(`uploads/${agent.getAgentDirectory()}/`);
//
//              done();
//            }).catch(err => {
//              done.fail(err);
//            });
//          }).catch(err => {
//            done.fail(err);
//          });
//        }).catch(err => {
//          done.fail(err);
//        });
//      });

//      it('writes a database record for each attached file', done => {
//        models.Invoice.find({}).then(invoices => {
//          expect(invoices.length).toEqual(0);
//
//          browser.attach('docs', 'spec/files/troll.jpg').then(res => {
//            models.Invoice.find({}).then(invoices => {
//              expect(invoices.length).toEqual(1);
//              expect(invoices[0].path).toMatch(`uploads/${agent.getAgentDirectory()}/`);
//
//              browser.attach('docs', 'spec/files/troll.png').then(res => {
//                models.Invoice.find({}).then(invoices => {
//                  expect(invoices.length).toEqual(2);
//                  expect(invoices[0].path).toMatch(`uploads/${agent.getAgentDirectory()}/`);
//                  expect(invoices[1].path).toMatch(`uploads/${agent.getAgentDirectory()}/`);
//
//                  done();
//                }).catch(err => {
//                  done.fail(err);
//                });
//              }).catch(err => {
//                done.fail(err);
//              });
//            }).catch(err => {
//              done.fail(err);
//            });
//          }).catch(err => {
//            done.fail(err);
//          });
//        }).catch(err => {
//          done.fail(err);
//        });
//      });
    });
  });
});
