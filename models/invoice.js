'use strict';


module.exports = function(mongoose) {
  const Schema = mongoose.Schema;
  require('mongoose-currency').loadType(mongoose);
  const moment = require('moment');
  const cc = require('currency-codes');
  const data = require('currency-codes/data');

  // Enums only work on strings
  const CATEGORIES = {
    '110': 'Commercial Travel',
    '120': 'Meals/Lodging',
    '140': 'National Co-working Meals/Lodging',
    '150': 'Passports, Visas, Immigration & Related Medical Expenses',
    '190': 'Other Travel Expenses',
    '200': 'Moving Travel and Other Moving Expenses',
    '210': 'Shipping for Moves and Temporary Storage during moves',
    '300': 'Promotional and Hospitality',
    '310': 'Photos and Recording Media',
    '400': 'Equipment',
    '410': 'Printing',
    '420': 'Postage',
    '430': 'Supplies and Stationery',
    '440': 'Communication (Phone, Fax, E-mail)',
    '450': 'Rent- seperate office/workspace in the home expense',
    '460': 'Child Education Costs (only if eligible)',
    '500': 'Professional Dues, Publications and Books',
    '510': 'Professional Development, Training and Study Programs',
    '520': 'Conferences',
    '530': 'National Co-workers\'s Wages'
  };

  const CURRENCIES = {};
  data.forEach(curr => CURRENCIES[curr.code] = curr.currency);

  const InvoiceSchema = new Schema({
    category: {
      type: String,
      trim: true,
      enum: { values: Object.keys(CATEGORIES), message: 'Invalid category' },
      required: [true, 'No category supplied'],
      empty: [true, 'No category supplied'],
    }, 
    purchaseDate: {
      type: Date,
      trim: true,
      required: [true, 'No purchase date supplied'],
      empty: [false, 'No purchase date supplied'],
    },
    reason: {
      type: String,
      trim: true,
      required: [true, 'No reason supplied'],
      empty: [false, 'No reason supplied'],
    },
    doc: {
      type: String,
      trim: true,
      required: [true, 'No document supplied'],
      empty: [false, 'No document supplied'],
      validate: {
        isAsync: true,
        validator: function(v, cb) {
          if (!this.isNew) return cb();
          this.model('Invoice').count({ doc: v }).then(count => {
            cb(!count);
          });
        },
        message: 'That document already exists'
      }
    },
    total: {
      type: Schema.Types.Currency,
      default: 0,
    },
    agent: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: [true, 'This invoice is not associated with an agent'],
    },
    currency: {
      type: Schema.Types.String,
      enum: { values: cc.codes(), message: 'Unknown currency' },
      required: [true, 'No currency symbol provided'],
      default: 'CAD'
    },
    exchangeRate: {
      type: Schema.Types.Number,
      required: [true, 'No exchange rate provided'],
      default: 1.0, 
    }
  }, {
    timestamps: true
  });

  /**
   * Get formatted currency strings
   */
  InvoiceSchema.methods.formatTotal = function() {
    return (this.total / 100).toFixed(2);
  };

  InvoiceSchema.methods.formatSubtotal = function() {
    return ((this.total/100) - ((this.total/100) * 0.05)).toFixed(2);
  };

  InvoiceSchema.methods.formatGst = function() {
    return ((this.total/100) * 0.05).toFixed(2);
  };

  InvoiceSchema.methods.convertToCAD = function() {
    return ((this.total/100) * this.exchangeRate).toFixed(2);
  };


  /**
   * Get formatted purchase date 
   */
  InvoiceSchema.methods.formatPurchaseDate = function() {
    return moment.utc(this.purchaseDate).format('YYYY-MM-DD');
  };

  /**
   * .getCategories
   */
  InvoiceSchema.statics.getCategories = function() {
    return CATEGORIES;
  };

  /**
   * .getCurrencies
   */
  InvoiceSchema.statics.getCurrencies = function() {
    return CURRENCIES;
  };


  return InvoiceSchema;
};

