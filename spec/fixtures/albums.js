'use strict';

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

exports.Album = {
  store: {
    _id: new ObjectId(),
    name: 'Summer Memories'
  }
};
