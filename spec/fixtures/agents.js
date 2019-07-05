'use strict';

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const bcrypt = require('bcrypt-nodejs');
const albums = require('./albums').Album;

exports.Agent = {
  dan: {
    _id: new ObjectId(),
    email: 'daniel@example.com',
    password: 'secret',
    submittables: [albums.store]
  },
  troy: {
    _id: new ObjectId(),
    email: 'troy@example.com',
    password: 'topsecret',
    reviewables: [albums.store]
  },
  lanny: {
    _id: new ObjectId(),
    email: 'lanny@example.com',
    password: 'supersecret',
    viewables: [albums.store]
  }
};
