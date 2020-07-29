/* Richard Meadows 2012, 2013, 2014 */

/* -------- Includes -------- */

var exec = require('child_process').exec;
var _ = require('underscore');

/* -------- Helper Functions -------- */

/**
 * Performs a n-point moving average on array.
 */
function moving_average(array, n) {
  var nums = [];

  for (i in array) {
    /* If this item in the array is a number */
    if (_.isNumber(array[i])) {
      nums.push(array[i]);
      if (nums.length > n) {
	nums.splice(0,1); /* Remove the first element of the array */
      }
      /* Take the average of the n items in this array */
      var sum = _.reduce(nums, function(memo, num){ return memo + num; }, 0);
      array[i] = sum/nums.length;
    }
  }

  return array;
}
/**
 * Performs a n-point maximum on array.
 */
function moving_maximum(array, n) {
  var nums = [];

  for (i in array) {
    if (_.isNumber(array[i])) {
      nums.push(array[i]);
      if (nums.length > n) {
	nums.splice(0,1); /* Remove the first element of the array */
      }
      /* Take the average of the n items in this array */
      var maximum = _.max(nums);
      array[i] = maximum;
    }
  }

  return array;
}
/**
 * Applys an n-point moving filter to a set of series.
 */
function apply_moving_filter(set, filter, n) {
  if (!_.isNumber(n)) { n = 3; }

  for (series in set) { /* For each series */
    /* Apply the filter */
    set[series] = filter(set[series], n);
  }

  return set;
}
/**
 * Returns the string to give to gnuplot based on the value of 
 time.
 */
function time_format(time) {
  if (_.isString(time)) {
    /* Translate the string we've been given into a format */
    switch(time) {
    case 'days':
    case 'Days':
      return "%d/%m";
    case 'hours':
    case 'Hours':
      return "%H:%M";
    default: /* Presume we've been given a gnuplot-readable time format string */
      return time;
    }
  } else { /* Just default to hours */
    return "%H:%M";
  }
}
/**
 * Sets up gnuplot based on the properties we're given in the options object.
 */
function setup_gnuplot(gnuplot, options) {
  var bg = (options.color && options.color.bg) || 'black';
  var border = (options.color && options.color.border) || 'white';
  var ytics = (options.color && options.color.ytics) || 'white';
  var xtics = (options.color && options.color.xtics) || 'white';
  var xlabel = (options.color && options.color.xlabel) || 'white';
  var ylabel = (options.color && options.color.ylabel) || 'white';
  var title = (options.color && options.color.title) || 'white';
  var grid = (options.color && options.color.grid) || 'white';
  var key = (options.color && options.color.key) || 'white';
  if (options.format === 'svg') { /* Setup gnuplot for SVG */
    gnuplot.stdin.write('set term svg fname \"Verdana\" fsize 11\n');
  } else if (options.format == 'pdf') {
    /* PDF: setup Gnuplot output to postscript so ps2pdf can interpret it */
    gnuplot.stdin.write('set term postscript landscape enhanced color dashed' +
			'\"Helvetica\" 14\n');
  } else { /* Setup gnuplot for png */
    gnuplot.stdin.write('set term png background rgb "' + bg + '" font Verdana 14 size 1280,1024\n');
  }

   /* Data range config */
   if (options.xRange) {
     gnuplot.stdin.write(`set xrange ['${options.xRange.min}':'${options.xRange.max}']\n`);
   }
   if (options.yRange) {
     gnuplot.stdin.write(`set yrange ['${options.yRange.min}':'${options.yRange.max}']\n`);
   }	
	
  /* Formatting Options */
  if (options.time) {
    gnuplot.stdin.write('set xdata time \n');
    gnuplot.stdin.write('set timefmt "%s"\n');
    gnuplot.stdin.write('set border lc rgb "' + border + '"\n');
    gnuplot.stdin.write('set ytics textcolor rgb "' + ytics + '"\n');
    gnuplot.stdin.write('set xtics textcolor rgb "' + xtics + '"\n');
    gnuplot.stdin.write('set key textcolor rgb "' + key + '"\n');
    gnuplot.stdin.write('set format x "' + time_format(options.time) + '"\n');
    gnuplot.stdin.write('set xlabel "time" textcolor rgb "' + xlabel + '"\n');
  }
  if (options.title) {
    gnuplot.stdin.write('set title "'+options.title+'" textcolor rgb "' + title + '" \n');
  }
  if (options.logscale) {
    gnuplot.stdin.write('set logscale y\n');
  }
  if (options.xlabel) {
    gnuplot.stdin.write('set xlabel "'+options.xlabel+'" textcolor rgb "' + xlabel + '" \n');
  }
  if (options.ylabel) {
    gnuplot.stdin.write('set ylabel "'+options.ylabel+'" textcolor rgb "' + ylabel + '" \n');
  }
  if (options.yFormat) {
    gnuplot.stdin.write(`set format y '${options.yFormat}'\n`);
  }	

  /* Setup ticks */
  gnuplot.stdin.write('set grid xtics ytics mxtics mytics ls 12 lc "' + grid + '", ls 13 lc "' + grid + '" \n');
  gnuplot.stdin.write('set  mxtics\n');

  if (options.nokey) {
    gnuplot.stdin.write('set nokey\n');
  }
}
/**
 * Called after Gnuplot has finished.
 */
function post_gnuplot_processing(error, stdout, stderr) {
  /* Print stuff */
  if (error !== null) {
    console.log('exec error: ' + error);
  }
}

/* -------- Public Functions -------- */

/**
 * Plots data to a PDF file. If it does not exist, the PDF file will
 * be created, otherwise this plot will be appended as a new page.
 */
function plot(options) {
  /* Required Options */
  if (!options.data) {
    throw("The options object must have 'data' property!");
    return;
  }
  /* Translate data into an object if needs be */
  if (_.isArray(options.data)) {
    /* If it's a one-dimentional array */
    if (_.isEqual(_.flatten(options.data), options.data)) {
      options.data = { 'Series 1': options.data };
    }
  }

  /* Defaults */
  if (!options.style) {
    options.style = 'lines'; /* Default to lines */
  }

  /* Apply moving averages and maximums */
  if (options.moving_avg) {
    options.data = apply_moving_filter(options.data, moving_average, options.moving_avg);
  }
  if (options.moving_max) {
    options.data = apply_moving_filter(options.data, moving_maximum, options.moving_max);
  }

  /* Execute Gnuplot specifing a function to be called when it terminates */
  if (options.format === 'pdf') { /* Special setup for pdf */
    gnuplot = exec('gnuplot | ps2pdf - ' + options.filename,
		   (options.exec ? options.exec : {}),
		   function (error, stdout, stderr) {
        if (options.finish) {
          options.finish.apply(this, [error, stdout, stderr]);
        } else {
          post_gnuplot_processing(error, stdout, stderr);
        }
       });

  } else if (options.filename) { /* Default for everything else */
    gnuplot = exec('gnuplot > ' + options.filename,
		   (options.exec ? options.exec : {}),
		   options.finish || post_gnuplot_processing);
  } else { /* Default for everything else */
    gnuplot = exec('gnuplot ',
       (options.exec ? options.exec : {}),
       function (error, stdout, stderr) {
        if (options.finish) {
          options.finish.apply(this, [error, stdout, stderr]);
        } else {
          post_gnuplot_processing(error, stdout, stderr);
        }
       });
  }

  /* Sets up gnuplot based on the properties we've been given in the
   * options object */
  setup_gnuplot(gnuplot, options);

  /* Get an array containing all the series */
  var series = _.keys(options.data);
  /* Reject series that are functions or come from higher up the protoype chain */
  var i;
  for (i = 0; i < series.length; i += 1) {
    if (!options.data.hasOwnProperty(series[i]) ||
	typeof options.data[series[i]] === 'function') {
      delete series[i]; /* undefine this element */
    }
  }
  /* Filter out any undefined elements */
  series = _.filter(series, function() { return true; });

  /* Print the command to actually do the plot */
  gnuplot.stdin.write('plot');
  for (i = 1; i <= series.length; i += 1) { /* For each series */
    /* Instruct gnuplot to plot this series */
    var props = options.data[series[i - 1]].props;
    var color = (props || {}).color ? 'rgb "' + props.color + '"' : i;
    var lineType = (props || {}).lineType ? props.lineType : '1';
    var lineWidth = (props || {}).lineWidth ? props.lineWidth : '1';
    var lineStyle = (props || {}).lineStyle ? props.lineStyle : options.style;
    var smooth = ((props || {}).smooth ? props.smooth : options.smooth) || 'unique';

    gnuplot.stdin.write('\'-\' using 1:2 smooth ' + smooth + ' title\'' + series[i - 1] +
			'\' with ' + lineStyle + ' lt ' + lineType + ' lw ' + lineWidth + ' lc ' + color);
    /* If another series is to follow, add a comma */
    if (i < series.length) { gnuplot.stdin.write(','); }
  }
  gnuplot.stdin.write('\n');

  /* Print out the data */
  for (i = 0; i < series.length; i += 1) { /* For each series */
    var dataSeries = (options.data[series[i]] || {}).series || options.data[series[i]];
    for (key in dataSeries) {
      gnuplot.stdin.write(key + ' ' + dataSeries[key] + '\n');
    }
    /* Terminate the data */
    gnuplot.stdin.write('e\n');
  }

  gnuplot.stdin.end();
}

/* -------- Exports -------- */

exports.plot = plot;
