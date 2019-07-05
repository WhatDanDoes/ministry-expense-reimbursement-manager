require('dotenv').config();
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const models = require('./models');

const app = express();

/**
 * Squelch 413s, 2019-6-28 https://stackoverflow.com/a/36514330
 */
const bodyParser = require('body-parser');
app.use(bodyParser.json({limit: "50mb"}));
app.use(bodyParser.urlencoded({limit: "50mb", extended: true, parameterLimit:50000}));

/**
 * Sessions
 */
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/config/config.json')[env];

const sessionConfig = {
  secret: 'supersecretkey',
  resave: false,
  saveUninitialized: false
};

if (env == 'production') {
  sessionConfig.store = new MongoStore({ mongooseConnection: models });
}

app.use(session(sessionConfig));


/**
 * Passport authentication
 */
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy({
    usernameField: 'email'
  },
  function(email, password, done) {
    models.Agent.findOne({ email: email }).then(function(agent) {
      if (!agent) {
        return done(null, false);
      }
      models.Agent.validPassword(password, agent.password, function(err, res) {
        if (err) {
          console.log(err);
        }
        return done(err, res);
      }, agent);
    }).catch(function(err) {
      return done(err);
    });

  }));

passport.serializeUser(function(agent, done) {
  done(null, agent._id);
});
passport.deserializeUser(function(id, done) {
  models.Agent.findById(id).then(function(agent) {
    agent.populate('images submittables reviewables viewables', function(err, agent) {
      if (err) {
        return done(err);
      }

      // Can't sort images on populate for some reason
      // 2016-11-22
      // http://stackoverflow.com/questions/8837454/sort-array-of-objects-by-single-key-with-date-value
      agent.images.sort(function(a, b){
        var keyA = new Date(a.createdAt),
            keyB = new Date(b.createdAt);
        if(keyA > keyB) return -1;
        if(keyA < keyB) return 1;
        return 0;
      });

      models.Album.populate(agent.images, { path: 'album', select: 'name' }, function(err, images) {
        return done(err, agent);
      });
    });
  }).catch(function(error) {
    return done(error);
  });
});

/**
 * Flash messages
 */
const flash = require('connect-flash');
app.use(flash());


/**
 * view engine setup
 */
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', require('./routes/index'));
app.use('/image', require('./routes/api'));
app.use('/login', require('./routes/login'));
app.use('/logout', require('./routes/logout'));
app.use('/album', require('./routes/album'));


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

let port = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'tor' ? 3000 : 3001;
app.listen(port, '0.0.0.0', () => {
  console.log('basic-photo-server listening on ' + port + '!');
});


module.exports = app;
