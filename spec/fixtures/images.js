'use strict';

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const albums = require('./albums').Album;
const agents = require('./agents').Agent;

exports.Image = {
  buy: {
    _id: new ObjectId(),
    description: 'Buy beer',
    total: -1599,
    album: albums.store._id,
    agent: agents.dan._id,
    tookPlaceAt: new Date('2018-1-1')
  },
  sell: {
    _id: new ObjectId(),
    description: 'Some doodad',
    total: '29.94',
    album: albums.store._id,
    agent: agents.troy._id,
    tookPlaceAt: new Date('2018-2-1')
  },
  bill: {
    _id: new ObjectId(),
    description: 'Consulting work',
    total: '$550.75',
    album: albums.store._id,
    agent: agents.lanny._id,
    tookPlaceAt: new Date('2018-3-1')
  }
};
