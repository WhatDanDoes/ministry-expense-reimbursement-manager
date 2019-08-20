'use strict';

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

const agents = require('./agents').Agent;

exports.Invoice = {
  bible: {
    _id: new ObjectId(),
    category: 400,
    purchaseDate: new Date('2019-8-12'),
    reason: 'Bible',
    total: 6599,
    doc: 'example.com/daniel/image1.jpg',
    agent: agents.dan._id,
  },
  pens: {
    _id: new ObjectId(),
    category: 430,
    purchaseDate: new Date('2019-8-10'),
    reason: 'Pens and staples',
    total: 965,
    doc: 'example.com/daniel/image2.pdf',
    agent: agents.dan._id,
  },
  server: {
    _id: new ObjectId(),
    category: 440,
    purchaseDate: new Date('2019-8-11'),
    reason: 'Cloud server',
    total: 1730,
    doc: 'example.com/daniel/image4',
    agent: agents.dan._id,
    currency: 'USD',
    exchangeRate: 1.35,
  },
};
