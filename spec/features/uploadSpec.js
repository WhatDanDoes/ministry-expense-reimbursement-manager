const request = require('supertest');
const fs = require('fs');
const timestamp = require('time-stamp');

const app = require('../app');

/**
 * `mock-fs` stubs the entire file system. So if a module hasn't
 * already been `require`d the tests will fail because the 
 * module doesn't exist in the mocked file system. `ejs` and
 * `iconv-lite/encodings` are required here to solve that 
 * problem.
 */
const mock = require('mock-fs');
require('ejs');
require('../node_modules/raw-body/node_modules/iconv-lite/encodings');

describe('POST image/', () => {

  let base64Image;
  beforeEach(done => {
    spyOn(timestamp, 'utc').and.returnValue('20190628114032');

    fs.readFile(`${__dirname}/data/troll.base64`, 'utf8', (err, data) => {
      if (err) {
        return done.fail(err);
      }
      base64Image = data;

      mock({ 
        'public/images/uploads': mock.directory({}),
        'views/error.ejs': fs.readFileSync('views/error.ejs')
      }, {createCwd: false, createTmp: false});

      done();
    });
  });

  afterEach(() => {
    mock.restore();
  });

  it('responds with 201 on successful receipt of base64 image', done => {
    request(app)
      .post('/image')
      .send({ base64Image: base64Image })
      .expect('Content-Type', /json/)
      .expect(201)
      .end(function(err, res) {
        if (err) {
          return done.fail(err);
        }
        expect(res.body.message).toEqual('Image received');
        done();
      });
  });

  it('writes the base64 image to the disk', done => {
    request(app)
      .post('/image')
      .send({ base64Image: base64Image })
      .expect(201)
      .end(function(err, res) {
        if (err) {
          //console.log(res);
          return done.fail(err);
        }
        expect(res.body.message).toEqual('Image received');

        fs.readFile('public/images/uploads/20190628114032.jpg', (err, data) => {

          if (err) {
            return done.fail(err);
          }
          expect(data).toBeDefined();

          done();
        });
    });
  });
});
