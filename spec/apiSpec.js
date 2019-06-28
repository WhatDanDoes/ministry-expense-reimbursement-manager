const request = require('supertest');

const app = require('../app');

describe('POST image/', () => {

  it('responds with 201 on successful receipt of base64 image', done => {
    request(app)
      .post('/image')
      .send({ base64Image: 'somelongbase64imagestring' })
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
    done.fail();
  });


});
