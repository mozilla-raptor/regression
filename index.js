var analyze = require('./lib/analyze-raptor');
var Promise = require('promise');
var fs = require('fs');
var debug = require('debug')('raptor-regression');

var metric = 'visuallyLoaded';

var readFile = function(dataFile) {
  debug('Processing %s', dataFile);
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

// Data is expected in the format that is output by using the following query:
// curl -G 'http://localhost:8086/query' --data-urlencode 'db=raptor' --data-urlencode
// "q=SELECT PERCENTILE(value, 95) as value FROM "measure" WHERE "metric" = 'visuallyLoaded'
// AND "context" = 'clock.gaiamobile.org' AND "branch" = 'master' AND "device" = 'flame-kk'
// AND "memory" = '319' AND "test" = 'cold-launch' AND time > '2015-09-09' AND time < '2015-09-17'
// GROUP BY time(15m), branch, device, memory fill(none)
var parseAppData = function(dataObj) {
  return new Promise(function(resolve, reject) {
    var perfData = [];
    var series = dataObj.results[0].series[0]['values'];

    series.forEach(function(entry) {
      var current = entry;

      perfData.push({
        time: current[0],
        value: current[1]
      });
    });

    debug("Found %s measures", perfData.length);
    resolve(perfData);
  });
};

var raptorRegression = function(dataFile) {
  return new Promise(function(resolve, reject) {
    var regressionList = [];
    readFile(dataFile)
      .then(function(dataObj) {
        return parseAppData(dataObj);
      })
      .then(function(perfData) {
        if (!perfData.length) {
          throw new Error("No meausures found");
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
