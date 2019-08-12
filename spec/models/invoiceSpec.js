'use strict';

/**
 * `mock-fs` stubs the entire file system. So if a module hasn't
 * already been `require`d the tests will fail because the 
 * module doesn't exist in the mocked file system. `ejs` and
 * `iconv-lite/encodings` are required here to solve that 
 * problem.
 */
const fs = require('fs');
const mock = require('mock-fs');
//const mockAndUnmock = require('../support/mockAndUnmock')(mock);
const fixtures = require('pow-mongoose-fixtures');
const models = require('../../models'); 

describe('Invoice', function() {
  const Invoice = models.Invoice;

  let invoice, agent;

  const _valid = {};
  beforeEach(function(done) {
    fixtures.load(__dirname + '/../fixtures/agents.js', models.mongoose, function(err) {
      if (err) return done.fail();
      models.Agent.findOne({ email: 'daniel@example.com' }).then(function(results) {
        agent = results;

        _valid.category = 110; 
        _valid.purchaseDate = new Date('2019-09-02');
        _valid.reason = 'Thank supporters';
        _valid.doc = `${agent.getAgentDirectory()}/receipt1.jpg`;
        _valid.total = '12.69';
        _valid.agent = agent._id;

        invoice = new Invoice(_valid);

        done();
      }).catch(function(error) {
        done.fail(error);
      });
    });
  });

  afterEach(function(done) {
    models.mongoose.connection.db.dropDatabase().then(function(result) {
      done();
    }).catch(function(err) {
      done.fail(err);         
    });
  });
 
  describe('basic validation', function() {
    const valid = {};
    beforeEach(function(done) {
        done();
    });

    it('sets the createdAt and updatedAt fields', function(done) {
      expect(invoice.createdAt).toBe(undefined);
      expect(invoice.updatedAt).toBe(undefined);
      invoice.save().then(function(obj) {
        expect(invoice.createdAt instanceof Date).toBe(true);
        expect(invoice.updatedAt instanceof Date).toBe(true);
        done();
      }).catch(err => {
        done.fail(err);
      });
    });
  
    it('does not allow an empty category field', function(done) {
      _valid.category = '    ';
      Invoice.create(_valid).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['category'].message).toEqual('No category supplied');
        done();
      });
    });

    it('does not allow an undefined category field', function(done) {
      delete _valid.category;
      Invoice.create(_valid).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['category'].message).toEqual('No category supplied');
        done();
      });
    });

    it('does not allow an invalid category field', function(done) {
      _valid.category = 666;
      Invoice.create(_valid).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['category'].message).toEqual('Invalid category');
        done();
      });
    });

    it('does not allow an invalid purchaseDate field', function(done) {
      _valid.purchaseDate = ' this is not a date   ';
      Invoice.create(_valid).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['purchaseDate'].message).toMatch('Cast to Date failed for value');
        done();
      });
    });

    it('does not allow an undefined purchaseDate field', function(done) {
      delete _valid.purchaseDate;
      Invoice.create(_valid).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['purchaseDate'].message).toEqual('No purchase date supplied');
        done();
      });
    });

    it('does not allow an empty reason field', function(done) {
      _valid.reason = '    ';
      Invoice.create(_valid).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['reason'].message).toEqual('No reason supplied');
        done();
      });
    });

    it('does not allow an undefined reason field', function(done) {
      delete _valid.reason;
      Invoice.create(_valid).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['reason'].message).toEqual('No reason supplied');
        done();
      });
    });

    it('does not allow an empty doc field', function(done) {
      _valid.doc = '    ';
      Invoice.create(_valid).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['doc'].message).toEqual('No document supplied');
        done();
      });
    });

    it('does not allow an undefined doc field', function(done) {
      delete _valid.doc;
      Invoice.create(_valid).then(function(obj) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['doc'].message).toEqual('No document supplied');
        done();
      });
    });

    it('does not allow a duplicate doc field', function(done) {
      Invoice.create(_valid).then(function(obj) {
        Invoice.create(_valid).then(function(obj) {
          done.fail('This should not have saved');
        }).catch(function(error) {
          expect(Object.keys(error.errors).length).toEqual(1);
          expect(error.errors['doc'].message).toEqual('That document already exists');
          done();
        });
      }).catch(function(error) {
        done.fail(error);
      });
    });

    it('sets the total to zero', function(done) {
      delete _valid.total;      
      Invoice.create(_valid).then(function(obj) {
        expect(obj.total).toEqual(0);   
        done();              
      }).catch(function(error) {      
        done.fail(error);    
      });                    
    });

    it('sets a blank total price to zero', function(done) {
      _valid.total = '  ';      
      Invoice.create(_valid).then(function(obj) {
        expect(obj.total).toEqual(0);   
        done();              
      }).catch(function(error) {      
        done.fail(error);    
      });                    
    });

    it('belongs to an agent', function(done) {
      invoice.agent = undefined;
      invoice.save().then(function(trans) {
        done.fail('This should not have saved');
      }).catch(function(error) {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['agent'].message).toEqual('This invoice is not associated with an agent');
 
        invoice.agent = agent._id;
        invoice.save().then(function(trans) {
          expect(invoice.agent).toBeDefined();
          done();
        }).catch(function(error) {
          done.fail(error);
        });
      });
    });
  });

  describe('currency formatting', function() {
    describe('#formatTotal', function() {
      it('returns the total property formatted as currency', function(done) {
        invoice.save().then(function(obj) {
          expect(invoice.total).toEqual(1269);
          expect(invoice.formatTotal()).toEqual('12.69');
          done();
        }).catch(function(error) {
          done.fail(error);
        });
      });
    });

    describe('#formatSubtotal', function() {
      it('returns the subtotal property formatted as currency', function(done) {
        invoice.save().then(function(obj) {
          expect(invoice.formatSubtotal()).toEqual('12.06');
          done();
        }).catch(function(error) {
          done.fail(error);
        });
      });
    });

    describe('#formatGst', function() {
      it('returns the gst property formatted as currency', function(done) {
        invoice.save().then(function(obj) {
          expect(invoice.formatGst()).toEqual('0.63');
          done();
        }).catch(function(error) {
          done.fail(error);
        });
      });
    });
  });

  describe('.getCategories', function() {
    it('returns the expenditure categories as an object', function() {
      const obj = Invoice.getCategories();
      expect(Object.keys(obj).length).toEqual(20);
    });
  });

  describe('#formatPurchaseDate', function() {
    it('returns the purchase date in YYYY-MM-DD format', function(done) {
      invoice.save().then(function(obj) {
        expect(invoice.total).toEqual(1269);
        expect(invoice.formatPurchaseDate()).toEqual('2019-09-02');
        done();
      }).catch(function(error) {
        done.fail(error);
      });
    });
  });
});
