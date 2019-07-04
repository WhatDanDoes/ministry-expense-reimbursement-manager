'use strict';

module.exports = function(mongoose) {
  const Schema = mongoose.Schema;
  const Types = Schema.Types;

  const ImageSchema = new Schema({
    tookPlaceAt: {
      type: Types.Date,
      default: Date.now
    },
    title: {
      type: Types.String,
      trim: true,
    },
    notes: {
      type: Types.String,
      trim: true
    },
    approved: {
      type: Types.Boolean,
      default: false
    },
    album: {
      type: Schema.Types.ObjectId,
      ref: 'Album',
      required: [true, 'This image is not associated with an album'],
    },
    agent: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: [true, 'This image is not associated with an agent'],
    },
    files: [{ type: Schema.Types.ObjectId, ref: 'ImageFile' }]
  }, {
    timestamps: true
  });

  /**
   * [De]flag image as _approved_
   *
   * @param function
   */
  ImageSchema.methods.review = function(done) {
    this.approved = !this.approved;
    this.save().then((obj) => {
      done(null, obj);
    }).catch((error) => {
      done(error);
    });
  };

  /**
   * Delete child dependencies (i.e., associated files)
   */
  ImageSchema.pre('remove', function(next) {
    mongoose.model('ImageFile').find({ image: this._id }).then((results) => {
      results.forEach((file) => {
        file.remove();
      });
      next();
    }).catch((error) => {
      next(error);
    });
  });

  return ImageSchema;
};

