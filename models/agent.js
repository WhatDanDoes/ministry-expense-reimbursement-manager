'use strict';

const bcrypt = require('bcrypt-nodejs');
//const findOrCreate = require('mongoose-findorcreate');

module.exports = function(mongoose) {
  const Schema = mongoose.Schema;
//  const Types = Schema.Types;

  const AgentSchema = new Schema({
    email: {
      type: String,
      trim: true,
      required: [true, 'No email supplied'],
      unique: true,
      empty: [false, 'No email supplied'],
      validate: {
        isAsync: true,
        validator: function(v, cb) {
          this.model('Agent').count({ email: v }).then(count => {
            cb(!count);
          });
        },
        message: 'That email is already registered'
      }
    },
    password: {
      type: String,
      trim: true,
      required: [true, 'No password supplied'],
      empty: [false, 'No password supplied'],
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  }, {
    timestamps: true
  });

  AgentSchema.pre('save', function(next) {
    var agent = this;

    // Only hash the password if it has been modified (or is new)
    if (!agent.isModified('password')) return next();

    // Generate a salt
    bcrypt.genSalt(10, function(err, salt) {
      if (err) return next(err);
      // Hash the password using our new salt
      bcrypt.hash(agent.password, salt, null, function(err, hash) {
        if (err) return next(err);
        // Override the cleartext password with the hashed one
        agent.password = hash;
        next();
      });
    });
  });

  AgentSchema.statics.validPassword = function(password, hash, done, agent) {
    bcrypt.compare(password, hash, function(err, isMatch) {
      if (err) console.log(err);
      if (isMatch) {
        return done(null, agent);
      } else {
        return done(null, false);
      }
    });
  };

  AgentSchema.methods.getAgentDirectory = function() {
    let parts = this.email.split('@');
    return `${parts[1]}/${parts[0]}` ;
  };


//  AgentSchema.plugin(findOrCreate);
  return AgentSchema;
};

