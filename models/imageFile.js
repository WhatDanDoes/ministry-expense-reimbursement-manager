'use strict';
const fs = require('fs');
const mv = require('mv');
const path = require('path');

module.exports = function(mongoose) {
  const Schema = mongoose.Schema;
  const Types = Schema.Types;

  const ImageFileSchema = new Schema({
    path: {
      type: Types.String,
      trim: true,
      required: [true, 'No image filename supplied'],
      unique: true,
      empty: [false, 'No image filename supplied'],
      validate: {
        isAsync: true,
        validator: function(v, cb) {
          this.model('ImageFile').count({ path: v }).then(count => {
            cb(!count);
          });
        },
        message: 'That image filename is taken'
      }
    },
    image: {
      type: Schema.Types.ObjectId,
      ref: 'Image',
      required: [true, 'Not associated with an image'],
    }
  }, {
    timestamps: true
  });

  ImageFileSchema.pre('save', function(next) {
    var parent = this;
    this.model('Image').findById(this.image).populate('album').then(function(image) {
      var date = new Date();
      var oldPath = parent.path;
      parent.path = 'uploads/' +
                     image.album.name.replace(' ', '') + '/' +
                     date.getFullYear() + '/' +
                     date.getMonth() + '/' +
                     date.getDate() + '/' +
                     path.basename(parent.path);

      parent.validate(function(err) {
        if (err) return next(err);

        mv(oldPath, parent.path, { mkdirp: true }, function(err) {
          if (err) return next(err);
          next();
        });
      });
    }).catch(function(err) {
      next(err);
    });
  });

  ImageFileSchema.pre('remove', function(next) {
    fs.unlink(this.path, function(err) {
      next(err);
    });
  });

  return ImageFileSchema;
};

