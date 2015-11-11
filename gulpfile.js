'use strict';

// Dependencies
var gulp = require('gulp');
var del = require('del');
var gutil = require('gulp-util');
var connect = require('gulp-connect');
var sass = require('gulp-sass');
var minifyCss = require('gulp-minify-css');
var autoprefixer = require('gulp-autoprefixer');
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var rename = require('gulp-rename');
var size = require('gulp-size');
var runSequence = require('run-sequence');

gulp.task('clean', function(callback) {
  return del(['./dist'], callback);
});

gulp.task('copy', function(callback) {
  return gulp.src('./index.html')
    .pipe(gulp.dest('./dist'))
});

gulp.task('build:css', function() {
  return gulp.src('src/scss/**/*.scss')
    .pipe(sass().on('error', function(err) {
      gutil.log("Error : " + err.message);
      this.emit('end');
    }))
    .pipe(autoprefixer({
      browsers: ['last 2 versions'],
      cascade: false
    }))
    .pipe(minifyCss({compatibility: 'ie8'}))
    .on('error', function(err) {
      gutil.log("Error : " + err.message);
      this.emit('end');
    })
    .pipe(rename('taw.min.css'))
    .pipe(size({'showFiles': true}))
    .pipe(gulp.dest('dist/css/'));
});

gulp.task('build:js', function() {
  return gulp.src(['node_modules/d3/d3.js',
    'node_modules/topojson/topojson.js',
    'node_modules/es6-promise/dist/es6-promise.js',
    'node_modules/underscore/underscore.js',
    'src/js/**/*.js'])
    .pipe(concat('taw.js'))
    .pipe(uglify())
    .on('error', function(err) {
      gutil.log('Error: ' + err.message);
      this.emit('end');
    })
    .pipe(rename('taw.min.js'))
    .pipe(size({'showFiles': true}))
    .pipe(gulp.dest('dist/js'));
});

gulp.task('watch', function() {
  gulp.watch('src/js/**/*.js', ['build:js']);
  gulp.watch('src/scss/**/*.scss', ['build:css']);
});

gulp.task('webserver', function(callback) {
  return connect.server({root: 'dist/', livereload: true}, callback);
});

gulp.task('default', function(callback) {
  return runSequence(
    'clean',
    'copy',
    ['build:css', 'build:js'],
    callback
  );
});

gulp.task('run', ['webserver', 'default', 'watch']);
