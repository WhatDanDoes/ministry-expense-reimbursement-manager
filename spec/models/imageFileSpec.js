'use strict';

describe('ImageFile', function() {
  const fixtures = require('pow-mongoose-fixtures');
  const fs = require('fs');
  const path = require('path');
  const mock = require('mock-fs');
  const mockAndUnmock = require('../support/mockAndUnmock')(mock);

  const db = require('../../models');
  const ImageFile = db.ImageFile;

  const _filename = '00000-receipt.jpg';
  const _filepath = '/tmp/' + _filename;

  var imageFile, image;

  beforeEach(function(done) {
    fixtures.load(__dirname + '/../fixtures/albums.js', db.mongoose, function(err) {
      if (err) done.fail(err);
      fixtures.load(__dirname + '/../fixtures/images.js', db.mongoose, function(err) {
        if (err) done.fail(err);
        db.Image.findOne().then(function(results) {
          image = results;
          mockAndUnmock({
            '/tmp/00000-receipt.jpg': fs.readFileSync('spec/files/receipt.jpg'),
            'uploads': { /* empty directory */ }
          });
          imageFile = new ImageFile({ path: _filepath, image: image.id });
          done();
        }).catch(function(err) {
          done.fail(err);
        });
      });
    });
  });

  afterEach(function(done) {
    db.mongoose.connection.db.dropDatabase().then(function(err, result) {
      mock.restore();
      done();
    }).catch(function(err) {
      done.fail(err);         
    });
  });
 
  describe('basic validation', function() {
    it('sets the createdAt and updatedAt fields', function(done) {
      expect(imageFile.createdAt).toBe(undefined);
      expect(imageFile.updatedAt).toBe(undefined);
      imageFile.save().then(function(obj) {
        expect(imageFile.createdAt instanceof Date).toBe(true);
        expect(imageFile.updatedAt instanceof Date).toBe(true);
        done();
      }).catch(function(error) {
        done.fail(error);
      });
    });
  
    it('does not allow two identical paths', function(done) {
      imageFile.save().then(function(obj) {
        ImageFile.create({ path: _filepath, image: image.id }).then(function(obj) {
          done.fail('This should not have saved');
        }).catch(function(error) {
          expect(Object.keys(error.errors).length).toEqual(1);
          expect(error.errors['path'].message).toEqual('That image filename is taken');
          done();
        });
      }).catch(function(error) {
        done.fail(error);
      });
    });

    it('does not allow an empty path field', function(done) {
      ImageFile.create({ path: ' ', image: image.id }).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['path'].message).toEqual('No image filename supplied');
        done();
      });
    });

    it('does not allow an undefined path field', function(done) {
      ImageFile.create({ image: image.id }).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['path'].message).toEqual('No image filename supplied');
        done();
      });
    });
  });

  /**
   * Document relationships
   */
  describe('relationships', function() {
    it('belongs to an image', function(done) {
      imageFile.image = undefined;
      imageFile.save().then(function(inv) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(error.errors['image'].message).toEqual('Not associated with an image');
        imageFile.image = image._id;
        imageFile.save().then(function(inv) {
          expect(imageFile.image).toBeDefined();
          imageFile.populate('image', function(err, i1) {
            if (err) done.fail(err);
            expect(imageFile.image.description).toEqual(image.description);
            image.files.push(imageFile);
            image.populate('files', function(err) {
              if (err) done.fail(err);
              expect(image.files.length).toEqual(1);
              expect(image.files[0].path).toEqual(imageFile.path);
              done();
            });
          });
        }).catch(function(error) {
          done.fail(error);
        });
      });
    });
  });

  /**
   * File handling
   */
  describe('file handling', function() {
    var date = new Date();
    var savePath;

    beforeEach(function() {
      savePath = 'uploads/SummerMemories'  + '/' + date.getFullYear() + '/' + date.getMonth() + '/' + date.getDate() + '/' + _filename
    });

    it('moves the file into the proper directory when record is saved', function(done) {
      fs.readdir('/tmp', function(err, files) {
        if (err) done.fail(err);
        expect(files.length).toEqual(1);
 
        fs.readdir('uploads', function(err, files) {
          if (err) done.fail(err);
          expect(files.length).toEqual(0);

          imageFile = new ImageFile({ path: _filepath, image: image.id });
          imageFile.save().then(function(ifile) {
            expect(ifile.path).toEqual(savePath);

            fs.readdir('/tmp', function(err, files) {
              if (err) done.fail(err);
              expect(files.length).toEqual(0);
              //fs.readdir(savePath, function(err, files) {
              fs.readdir('uploads', function(err, files) {
                if (err) done.fail(err);
                expect(files.length).toEqual(1);
                done();
              });
             });
          }).catch(function(err) {
            done.fail(err);
          });
        });
      });
    });

    it('removes the file when the record is deleted', function(done) {
      imageFile = new ImageFile({ path: _filepath, image: image.id });
      imageFile.save().then(function(ifile) {
        fs.readdir('uploads', function(err, files) {
          if (err) done.fail(err);
          expect(files.length).toEqual(1);

          // Remove
          imageFile.remove().then(function(i1) {
            fs.readdir(path.dirname(i1.path), function(err, files) {
              if (err) done.fail(err);
              expect(files.length).toEqual(0);
              done();
            });
          }).catch(function(err) {
            done.fail(err);
          });
        });
      }).catch(function(err) {
        done.fail(err);
      });
    });
  });
});
