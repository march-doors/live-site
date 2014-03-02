// include gulp
var gulp = require('gulp'); 
 
// include plug-ins
var jshint = require('gulp-jshint');
var changed = require('gulp-changed');
var imagemin = require('gulp-imagemin');
var concat = require('gulp-concat');
// var stripDebug = require('gulp-strip-debug');
var uglify = require('gulp-uglify');
var autoprefix = require('gulp-autoprefixer');
var minifyCSS = require('gulp-minify-css');
// var sass = require('gulp-sass');
var compass = require('gulp-compass');
var fileinclude = require('gulp-file-include');
var markdown = require('gulp-markdown');
 
// JS hint task
gulp.task('jshint', function() {
  gulp.src('./src/scripts/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

// minify new images
gulp.task('imagemin', function() {
  var imgSrc = './_src/img/**/*',
      imgDst = './img';
 
  gulp.src(imgSrc)
    .pipe(changed(imgDst))
    .pipe(imagemin())
    .pipe(gulp.dest(imgDst));
});

// move changed PHP and HTML pages
gulp.task('htmlpage', function() {
  var htmlSrc = './_src/*.html',
      mdSrc = './_src/*.md',
      phpSrc = './_src/*.php',
      htmlDst = './build';

  gulp.src(mdSrc)
    .pipe(changed(htmlDst))
    .pipe(markdown())
    .pipe(gulp.dest(htmlDst));
 
  gulp.src(htmlSrc)
    .pipe(changed(htmlDst))
    // .pipe(markdown())
    .pipe(gulp.dest(htmlDst));

  gulp.src(phpSrc)
    .pipe(changed(htmlDst))
    .pipe(gulp.dest(htmlDst));
});

// JS concat, strip debugging and minify
gulp.task('scripts', function() {
  gulp.src(['./_src/js/*.js'])
    .pipe(concat('script.js'))
    // .pipe(stripDebug())
    // .pipe(uglify())
    .pipe(gulp.dest('./js/'));
});

// CSS concat, auto-prefix and minify
gulp.task('styles', function() {
  // gulp.src(['./_src/scss/*.scss'])
  //   .pipe(concat('temp-style.scss'))
  //   .pipe(sass({ includePaths : ['./_src/scss/'] }))
  //   .pipe(concat('style.css'))
  //   .pipe(autoprefix('last 2 versions'))
  //   .pipe(minifyCSS())
  //   .pipe(gulp.dest('./css/'));


  return gulp.src('_src/scss/style.scss')
    .pipe(compass({
      sass: '_src/scss',
      css: 'css'
    }))
    .pipe(autoprefix('last 2 version'))
    .pipe(gulp.dest('css'))
    // .pipe(rename({ suffix: '.min' }))
    // .pipe(minifyCSS())
    // .pipe(livereload(server))
    .pipe(gulp.dest('css'));
    // .pipe(notify({ message: 'Styles task complete' }));
});


// default gulp task
gulp.task('default', ['imagemin', 'scripts', 'styles'], function() {

  // watch for JS changes
  gulp.watch('./_src/js/*.js', function() {
    gulp.run('jshint', 'scripts');
  });
 
  // watch for CSS changes
  gulp.watch('./_src/scss/*.scss', function() {
    gulp.run('styles');
  });
});