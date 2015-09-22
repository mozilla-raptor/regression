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
// "q=select percentile(value, 95) from measure where metric='visuallyLoaded' and
// context='communications.gaiamobile.org@dialer' and time > now() - 7d group by
// revisionId; select * from annotation"

var parseAppData = function(dataObj) {
  return new Promise(function(resolve, reject) {
    var perfData = [];
    var series = dataObj.results[0].series;

    series.forEach(function(entry) {
      var current = entry;

      // only want measures
      if (current.name !== 'measure') {
        return;
      }

      perfData.push({
        revisionId: current.tags.revisionId,
        value: current.values[0][1]
      });

      // TO-DO: Parse the annotation data into a different array
      // so that it can be used later to look the actual gaia
      // and gecko versions from the revisionId value
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
