'use strict';

let regression = require('./lib');
let R = require('ramda');

/**
 * Generate regression candidate points by creating a new object with columns as
 * keys, values as the object values, and merge with a base object containing
 * tags and measurement name
 * @param {Function} merger function which generates new object with base object of tags
 * @param {String} name measurement name
 * @param {Array} columns collection of object keys
 * @param {Array} values collection of object values
 * @returns {Array}
 */
let mergeColumnsWithValues = (merger, name, columns, values) => {
  return R.map(R.pipe(
    R.zipObj(columns),
    merger,
    R.merge(R.objOf('name', name))
  ), values);
};

/**
 * Transform an InfluxDB query resultset into -> Array<{ value: Number }>
 * @returns Array
 */
let transform = R.pipe(
  R.prop('results'), // Each query has a single "results" property;
  R.map(R.prop('series')), // Get all the series from results,
  R.flatten, // Squish all the series together
  R.map(R.converge(mergeColumnsWithValues, [ // Generate all the points per series by merging together:
    R.pipe(R.prop('tags'), R.merge), // The tags for the series as the base of the new point,
    R.prop('name'), // Set the name as the measurement name,
    R.prop('columns'), // Use the columns as new keys in the object
    R.prop('values') // And the values as the key-values to the columns
  ])),
  R.flatten // Finally, squish all the points together across series into a single array
);

module.exports = (cli) => {
  return cli
    .command('regression')
    .description('Pipe in an InfluxDB query result to search for performance regressions')
    .action(function() {
      /**
       * Command flow:
       * 1. Read the contents of stdin, parse as JSON
       * 2. Transform the query results into a format understood by raptor-regression
       * 3. Pass the formatted data to raptor-regression
       * 4. Either output the regression results as JSON to the console,
       * 5. Or output any errors encountered along the way
       */
      return Promise
        .resolve()
        .then(cli.stdin)
        .then(transform)
        .then(regression)
        .then(cli.JSON)
        .catch(cli.exits);
    });
};
