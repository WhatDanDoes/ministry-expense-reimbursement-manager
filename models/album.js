'use strict';

module.exports = function(mongoose) {
  const Schema = mongoose.Schema;
  const Types = Schema.Types;

  const AlbumSchema = new Schema({
    name: {
      type: Types.String,
      trim: true,
      required: [true, 'No album name supplied'],
      unique: true,
      empty: [false, 'No album name supplied'],
      validate: {
        isAsync: true,
        validator: function(v, cb) {
          this.model('Album').count({ name: v }).then(count => {
            cb(!count);
          });
        },
        message: 'That album name is taken'
      }
    },
    images: [{ type: Schema.Types.ObjectId, ref: 'Image' }],
    reviewers: [{ type: Schema.Types.ObjectId, ref: 'Agent' }],
    submitters: [{ type: Schema.Types.ObjectId, ref: 'Agent' }],
    viewers: [{ type: Schema.Types.ObjectId, ref: 'Agent' }],
  }, {
    timestamps: true
  });

  return AlbumSchema;
};

