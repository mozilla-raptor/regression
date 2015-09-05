var analyze = require('./lib/analyze-raptor');
var Promise = require('promise');
var fs = require('fs');
var debug = require('debug')('raptor-regression');

var metric = 'visuallyLoaded';

var readFile = function(dataFile, appContext, appEntryPoint) {
  debug('Processing %s', dataFile);
  debug('App (context: %s, entrypoint: %s)', appContext, appEntryPoint);
  return new Promise(function(resolve, reject) {
    fs.readFile(dataFile, { encoding: 'utf8' }, function(err, content) {
      if (err) {
        return reject(err);
      }

      var data = JSON.parse(content.split('\n'));
      resolve(data);
    });
  });
};

var parseAppData = function(dataObj, appContext, appEntryPoint) {
  return new Promise(function(resolve, reject) {
    var perfData = [];
    var series = dataObj.results[0].series;

    series.forEach(function(entry){
      var current = entry;
      // only want measures
      if (current.name !== 'measure') {
        return;
      }

      // step thru each measure entry
      current.values.forEach(function(measure) {
        var fullName = appContext;
        // only want specific app & entrypoint (if provided)
        if (appEntryPoint) {
          fullName += '@' + appEntryPoint;
        }
        if (measure[2] !== fullName) {
          return;
        }
        // only interested in specified metric ie. visuallyLoaded
        if (measure[6] !== metric) {
          return;
        }

        perfData.push({
          time: measure[4],
          value: measure[10],
          revisionId: measure[8]
        });
      });
    });

    debug("Found %s '%s' measures", perfData.length, metric);
    resolve(perfData);
  });
};

var raptorRegression = function(dataFile, appContext, appEntryPoint) {
  return new Promise(function(resolve, reject) {
    var regressionList = [];
    readFile(dataFile, appContext, appEntryPoint)
      .then(function(dataObj) {
        return parseAppData(dataObj, appContext, appEntryPoint);
      })
      .then(function(perfData) {
        if (!perfData.length) {
          throw new Error("No '%s' meaures found for app (context: %s, entrypoint: %s)");
        }

        return analyze(perfData);
      })
      .then(function(regressionList) {
        if (regressionList.length) {
          debug("Regressions detected");
        } else {
          debug("No regressions detected");
        }

        resolve(regressionList);
      })
      .catch(reject);
    });
};

module.exports = raptorRegression;
