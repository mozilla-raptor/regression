// derived from https://github.com/eliperelman/phanalysis/blob/master/phanalyzer/analyze.py

var debug = require('debug')('raptor-regression');

var calcWeightedAvg = function(values, weightType) {
  var n = values.length;

  var weights = [];
  values.forEach(function(item, index) {
    var weight = 1.0;
    if (weightType === 'linear') {
      if (index >= n) {
        weight = 0.0;
      } else {
        weight = (n - index) / n;
      }
    }
    weights.push(weight);
  });

  var weightedValuesSum = 0;
  values.forEach(function(item, index) {
    weightedValuesSum += item * weights[index];
  });

  if (n > 0) {
    var weightedSum = values.reduce(function(a, b) {
      return a + b;
    });
    var weightedAvg = weightedValuesSum / weightedSum;
  } else {
    var weightedAvg = 0.0;
  }

  return weightedAvg;
};

var calcVariance = function(values, weightedAvg) {
  var n = values.length;
  var variance = 0.0;

  if (n > 1) {
    var total = 0;
    var x = 0;
    values.forEach(function(item, index) {
      total += Math.pow(item - weightedAvg, 2);
    });
    variance = total / (n - 1);
  }

  return variance;
};

var getStats = function(values, weightType) {
  var n = values.length;

  // calculate average for given values
  var weightedAvg = calcWeightedAvg(values, weightType);

  // calculate variance for given values
  var variance = calcVariance(values, weightedAvg);

  var result = {
    avg: weightedAvg,
    n: n,
    variance: variance
  };

  return result;
};

var calcT = function(dataSet1, dataSet2) {
  if (!dataSet1.length || !dataSet2.length) {
    return 0;
  }

  var s1 = getStats(dataSet1, 'linear');
  var s2 = getStats(dataSet2, 'linear');
  
  var deltaS = s2.avg - s1.avg;

  if (deltaS === 0) {
    return 0;
  }

  if (s1.variance === 0 && s2.variance === 0) {
    return Infinity;
  }

  var x = Math.pow(((s1.variance / s1.n) + (s2.variance / s2.n)), 0.5);
  var result = deltaS / x;

  return result;
};

var analyzeT = function(perfData) {
  return new Promise(function(resolve, reject) {
    var backWindow = 12;
    var foreWindow = 12;
    var tThreshold = 7;
    var goodData = [];

    debug("Performing tTest, backWindow: %d, foreWindow: %d, tThreshold: %d", 
      backWindow, foreWindow, tThreshold);
    // analyze test data using T-Tests, comparing data[i-j:i] to data[i:i+k]
    var numPoints = perfData.length - foreWindow + 1;
    var j = backWindow;
    var k = foreWindow;

    perfData.forEach(function(item, index) {
      var di = perfData[index];

      var jw = goodData
        .slice(-j)
        .map(function(entry) {
          return parseInt(entry.value, 10);
        })
        .reverse(); // reverse backward data so current point is at start of window

      var kw = perfData
        .slice(index, index + k)
        .map(function(entry) {
          return parseInt(entry.value, 10);
        });

      if (jw.length) {
        di.historicalStats = getStats(jw, 'default');
      }

      if (kw.length) {
        di.forwardStats = getStats(kw, 'default');
      }

      if (jw.length >= j) {
        di.t = calcT(jw, kw);
      } else {
        // assume it's ok, we don't have enough data
        di.t = 0
      }

      goodData.push(di);
    });

    // now that the t-test scores are calculated, go back through the data to
    // find where regressions most likely happened
    goodData.forEach(function(entry, index) {
      if (entry.t <= tThreshold) {
        return;
      }

      // check the adjacent points
      var prev = goodData[entry - 1];

      if (prev.t > entry.t) {
        return;
      }

      var next = goodData[entry + 1];

      if (next.t > entry.t) {
        return;
      }

      // this datapoint has a 't' score higher than the threshold and higher
      // than either neighbor, so mark it as the cause of a regression
      debug('Regression detected');
      entry.state = 'regression';
    });

    // return all but the first and last points whose scores we calculated,
    // since we can only produce a final decision for a point whose scores
    // were compared to both of its neighbors.
    resolve(perfData.slice(1, numPoints - 1));
  });
};

var analyzeRaptor = function(perfData) {
  return new Promise(function(resolve, reject) {
    analyzeT(perfData)
      .then(function(results) {
        var regressionList = [];

        results.forEach(function(result, index) {
          if (result.state === 'regression') {
            var prevRev = 'none';
            var prevAvg = 0;

            if (index !== 0) {
              var prevRev = results[index - 1].revisionId;
              var prevAvg = results[index - 1].historicalStats
            }

            regressionList.push({ 
              confidence: result.t,
              revisionId: result.revisionId,
              prevRevisionId: prevRev,
              oldAvg: prevAvg,
              newAvg: result.forwardStats
            });
          }
        });

        resolve(regressionList);
      });
  });
};

module.exports = analyzeRaptor;
