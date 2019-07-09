'use strict';

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const bcrypt = require('bcrypt-nodejs');

exports.Agent = {
  dan: {
    _id: new ObjectId(),
    email: 'daniel@example.com',
    password: 'secret',
  },
  troy: {
    _id: new ObjectId(),
    email: 'troy@example.com',
    password: 'topsecret',
  },
  lanny: {
    _id: new ObjectId(),
    email: 'lanny@example.com',
    password: 'supersecret',
  }
};
