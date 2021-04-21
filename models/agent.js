'use strict';

const fs = require('fs');

module.exports = function(mongoose) {
  const Schema = mongoose.Schema;

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
          if (!this.isNew) return cb();
          this.model('Agent').count({ email: v }).then(count => {
            cb(!count);
          });
        },
        message: 'That email is already registered'
      }
    },
    // use $addToSet to ensure not duplicates
    canRead: [{ type: Schema.Types.ObjectId, ref: 'Agent' }],
    canWrite: [{ type: Schema.Types.ObjectId, ref: 'Agent' }],
  }, {
    timestamps: true,
    strict: false
  });

  AgentSchema.methods.getAgentDirectory = function() {
    let parts = this.email.split('@');
    return `${parts[1]}/${parts[0]}` ;
  };

  /**
   * Function to count files in directories provided
   */
  function countFiles(dirs, done, result=[]) {
    if (!dirs.length) {
      return done(null, result);
    }
    let path = dirs.shift();


    // 2019-7-25 https://github.com/tschaub/mock-fs/issues/272
    // `mock-fs` currently does not support `withFileTypes`.
    // Change the `readdir`/`stat` call to that below at the earliest opportunity
    //fs.readdir(path, { withFileTypes: true }, (err, files) => {

    fs.readdir(`uploads/${path}`, (err, list) => {
      if (err) {
        // Directory doesn't exist
        if (err.code === 'ENOENT') {
          result.push({ path: path, files: [] });
          return countFiles(dirs, done, result);
        }
        return done(err);
      }

      // Don't want directories, just files
      (function getFiles(done, files=[]) {
        if (err) {
          return done(err);
        }

        if (!list.length) {
          return done(null, files);
        }
        let file = list.shift();

        fs.stat(`uploads/${path}/${file}`, (err, stat) => {
          if (err) {
            return done(err);
          }
          if (stat.isFile()) {
            files.push(file);
          }
          getFiles(done, files);
        });
      })((err, files) => {
        if (err) {
          return done(err);
        }

        result.push({ path: path, files: files });
        countFiles(dirs, done, result);
      });
    });
  }

  AgentSchema.methods.getReadablesAndFiles = function(done) {
    this.populate('canRead', (err, agent) => {
      if (err) {
        return done(err);
      }

      let readables = agent.canRead.map(a => a.getAgentDirectory());
      readables.push(this.getAgentDirectory());

      countFiles(readables, (err, result) => {
        if (err) {
          return done(err);
        }
        done(null, result);
      });
    });
  };

  AgentSchema.methods.getReadables = function(done) {
    this.populate('canRead', (err, agent) => {
      if (err) {
        return done(err);
      }

      let readables = agent.canRead.map(a => a.getAgentDirectory());
      readables.push(this.getAgentDirectory());
      done(null, readables);
    });
  };

  AgentSchema.methods.getWritables = function(done) {
    this.populate('canWrite', (err, agent) => {
      if (err) {
        return done(err);
      }

      let writables = agent.canWrite.map(a => a.getAgentDirectory());
      writables.push(this.getAgentDirectory());
      done(null, writables);
    });
  };

  AgentSchema.methods.getWritablesAndFiles = function(done) {
    this.populate('canWrite', (err, agent) => {
      if (err) {
        return done(err);
      }

      let writables = agent.canWrite.map(a => a.getAgentDirectory());
      writables.push(this.getAgentDirectory());

      countFiles(writables, (err, result) => {
        if (err) {
          return done(err);
        }
        done(null, result);
      });
    });
  };
  
  // The toLocaleString method returns different results in Ubuntu 18 and 16:
  // date.toLocaleString('default', { month: 'short' })
  // This is a brute force solution.
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  AgentSchema.methods.getBaseFilename = function() {
    let name = this.name.split(/ (.+)/);
    name = name.filter(n => n.length > 0);
    let firstname = name[0],
        lastname = name[1];
    let date = new Date(Date.now());
    return `${lastname}, ${firstname} ${date.getFullYear()} ${("0" + (date.getMonth() + 1)).slice(-2)} ${MONTHS[date.getMonth()]} Reimb Receipt`;
  };

  return AgentSchema;
};

