var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require('cors');

var initialRouter= require('./routes/index');
var staffRouter = require('./routes/staff');
var departmentRouter = require('./routes/departments');
var classRouter = require('./routes/class');
var subjectRouter = require('./routes/subject');
var teacherRouter = require('./routes/teacher');
var academicYearRouter = require('./routes/academicYear');
var academicTermRouter = require('./routes/academicTerm');
var assignRouter = require('./routes/assigning');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());  // Enable CORS for all origins


// Routes
app.use('/', initialRouter);
app.use('/api/v1/staff', staffRouter);
app.use('/api/v1/department', departmentRouter);
app.use('/api/v1/class', classRouter);
app.use('/api/v1/subject', subjectRouter);
app.use('/api/v1/teacher', teacherRouter);
app.use('/api/v1/academic_year', academicYearRouter);
app.use('/api/v1/academic_term', academicTermRouter);
app.use('/api/v1/assigning', assignRouter)

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

module.exports = app;
