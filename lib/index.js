'use strict';

let R = require('ramda');

const BACKWINDOW_SIZE = 12;
const FOREWINDOW_SIZE = 12;
const T_THRESHOLD = 7;

/**
 * Always get 1
 * @returns 1
 */
let single = R.always(1);

/**
 * Always get zero
 * @returns 0
 */
let zero = R.always(0);

/**
 * Always get Infinity
 * @returns Infinity
 */
let infinity = R.always(Infinity);

/**
 * Get the square of a number
 * @param {Number}
 * @returns {Number}
 */
let square = R.partialRight(Math.pow, [2]);

/**
 * Square every number in a collection
 * @param {Array<Number>} numbers
 * @returns {Array<Number>}
 */
let squareAll = R.map(square);

/**
 * Get the numerator for a variance calculation by summing the squares of a collection
 * @param {Array<Number>} numbers
 * @returns {Number}
 */
let varianceNumerator = R.pipe(squareAll, R.sum);

/**
 * Get the denominator for a variance calculation by decrementing the length of a collection
 * @param {Array} array
 * @returns {Number}
 */
let varianceDivisor = R.pipe(R.length, R.dec);

/**
 * Map over an array with additional arguments for index and original array
 * @param {Array} array
 * @returns {Array}
 */
let mapIndexed = R.addIndex(R.map);

/**
 * For given collections of values and weights, multiply each pair and sum together all the products
 * @param {Array<Number>} values
 * @param {Array<Number>} weights
 * @returns Number
 */
let calculateWeightedSum = R.pipe(R.zip, R.map(R.partial(R.apply, [R.multiply])), R.sum);

/**
 * Calculate the variance of a collection of numbers
 * @param {Array<Number>} numbers
 */
let variance = R.cond([
  [R.isEmpty, zero],
  [R.T, R.converge(R.divide, [varianceNumerator, varianceDivisor])]
]);

/**
 * Calculate the weighted moving average that gives higher weight to values at
 * the origin, smoothing out towards the end for a given collection of numbers
 * @param {Array<Number>} numbers
 * @returns {Array<Number>}
 */
let linear = R.partial(mapIndexed, [(value, index, array) => R.divide(R.subtract(R.length(array), index), R.length(array))]);

/**
 * Return a subset of statistically viable points from a larger dataset
 * @param {Array} window
 * @returns {Array}
 */
let sliceWindow = (window) => R.slice(0, R.subtract(R.length(window), R.inc(FOREWINDOW_SIZE)), window);

/**
 * Fetch the back-window values and fore-window values for each item in a dataset
 * @param {Array} array
 * @returns {Array}
 */
let getWindows = R.partial(mapIndexed, [(current, index, array) => {
  return {
    current: current,
    back: R.reverse(R.pluck('value', R.slice(R.subtract(index, BACKWINDOW_SIZE), index, array))),
    fore: R.pluck('value', R.slice(index, R.add(index, FOREWINDOW_SIZE), array))
  };
}]);

/**
 * Group each regression candidate with its adjacent candidates
 * @param {Array} array
 * @returns {Array}
 */
let groupCandidates = mapIndexed((value, index, array) => {
  return {
    regressor: value,
    previous: R.nth(R.dec(index), array),
    next: R.nth(R.inc(index), array)
  };
});

/**
 * Determine if a regression candidate group is an actual regression
 * @param {Object} candidate
 * @returns {Boolean}
 */
let isRegression = (candidate) => {
  return candidate.previous &&
    candidate.next &&
    R.gt(candidate.regressor.tValue, T_THRESHOLD) &&
    R.lte(candidate.previous.tValue, candidate.regressor.tValue) &&
    R.lte(candidate.next.tValue, candidate.regressor.tValue);
};

/**
 * Search a collection of analyses for regressions
 * @param {Array}
 * @returns {Array}
 */
let findRegressions = R.pipe(groupCandidates, R.filter(isRegression));

/**
 * Analyze a set of values and weights with their average and variance
 * @param {Array<Number>} values
 * @param {Array<Number>} weights
 * @returns {{length: Number, average: Number, variance: Number}}
 */
let analyze = (values, weights) => {
  let weightedAverage = R.isEmpty(values) ?
    0 :
    R.divide(calculateWeightedSum(values, weights), R.sum(weights));

  return {
    length: R.length(values),
    average: weightedAverage,
    variance: variance(R.map(R.add(R.negate(weightedAverage)), values))
  };
};

/**
 * Run an analysis on a set a values using uniform weighing
 * @param {Array<Number>} values
 * @returns {{length: Number, average: Number, variance: Number}}
 */
let analyzeSingle = R.converge(analyze, [R.identity, R.map(single)]);

/**
 * Run an analysis on a set a values using linear weighing
 * @param {Array<Number>} values
 * @returns {{length: Number, average: Number, variance: Number}}
 */
let analyzeLinear = R.converge(analyze, [R.identity, linear]);

/**
 * Determine the delta of the averages of an analysis pair
 * @param {Object} a primary analysis
 * @param {Object} b secondary analysis
 * @returns {number}
 */
let averagesDelta = (a, b) => R.subtract(b.average, a.average);

/**
 * Determine whether the delta of an analysis pair averages is zero
 * @param {Object} a primary analysis
 * @param {Object} b secondary analysis
 * @returns {Boolean}
 */
let deltaIsZero = R.pipe(averagesDelta, R.equals(0));

/**
 * Calculate the denominator for a T-test of an analysis pair
 * @param {Object} a primary analysis
 * @param {Object} b secondary analysis
 * @returns {number}
 */
let calculateTDivisor = (a, b) => {
  return Math.pow(R.add(
    R.divide(a.variance, a.length),
    R.divide(b.variance, b.length)
  ), 0.5);
};

/**
 * Determine whether a pair of analyses contain no relevant data
 * @param {Object} a primary analysis
 * @param {Object} b secondary analysis
 * @returns {Boolean}
 */
let eitherEmpty = (a, b) => R.or(R.isEmpty(a), R.isEmpty(b));

/**
 * Determine whether a pair of analyses both have a zero variance
 * @param {Object} a primary analysis
 * @param {Object} b secondary analysis
 * @returns {Boolean}
 */
let bothZeroVariance = (a, b) => R.and(R.equals(0, a.variance), R.equals(0, b.variance));

/**
 * Calculate a statistical T-test for a pair of analyses
 * @param {Object} a primary analysis
 * @param {Object} b secondary analysis
 * @returns {Number}
 */
let tTest = R.converge(R.pipe(R.divide, Math.abs), [averagesDelta, calculateTDivisor]);

/**
 * Calculate the normalized T-test value for a pair of analyses
 * @param {Object} a primary analysis
 * @param {Object} b secondary analysis
 * @returns {Number}
 */
let calculateTValue = R.cond([
  [eitherEmpty, zero],
  [deltaIsZero, zero],
  [bothZeroVariance, infinity],
  [R.T, tTest]
]);

/**
 * Fetch the normalized T-test value for a collection of windows
 * @param {Array} backWindow
 * @param {Array} foreWindow
 * @returns {Number}
 */
let getTValueForWindows = (backWindow, foreWindow) => {
  return R.lt(R.length(backWindow), BACKWINDOW_SIZE) ?
    0 :
    calculateTValue(analyzeLinear(backWindow), analyzeLinear(foreWindow));
};

/**
 * Generate a statistical analysis for a dataset of sliding windows
 * @param {Array} window
 * @returns {Array<Object>}
 */
let mapAnalyses = R.map((window) => {
  return {
    source: window.current,
    backAnalysis: analyzeSingle(window.back),
    foreAnalysis: analyzeSingle(window.fore),
    tValue: getTValueForWindows(window.back, window.fore)
  };
});

/**
 * Search a dataset for potential regressions using sliding T-tests, returning
 * an array of regressions with the regressor and its adjacent points
 * @param {Array<{ value: Number }>} dataset
 * @returns {Array<{ regressor: Object, previous: Object, next: Object }>}
 */
module.exports = R.pipe(getWindows, sliceWindow, mapAnalyses, findRegressions);
