'use strict';

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const image = require('./images').Image;

exports.ImageFile = {
  receipt1: {
    _id: new ObjectId(),
    image: image.buy._id,
    path: 'spec/files/receipt.gif'
  },
  receipt2: {
    _id: new ObjectId(),
    image: image.sell._id,
    path: 'spec/files/receipt.jpg'
  }
};
