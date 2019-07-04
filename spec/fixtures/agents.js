'use strict';

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const bcrypt = require('bcrypt-nodejs');
//const accounts = require('./accounts').Account;

exports.Agent = {
  dan: {
    _id: new ObjectId(),
    email: 'daniel@example.com',
    password: 'secret',
//    submittables: [accounts.store]
  },
  troy: {
    _id: new ObjectId(),
    email: 'troy@example.com',
    password: 'topsecret',
//    reviewables: [accounts.store]
  },
  lanny: {
    _id: new ObjectId(),
    email: 'lanny@example.com',
    password: 'supersecret',
//    viewables: [accounts.store]
  }
};
