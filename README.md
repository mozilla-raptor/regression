# raptor-regression

Search for linear regressions in a dataset using sliding T-tests.

## Install

`npm install --save raptor-regression`

## Quick start

```js
var regression = require('raptor-regression');

var offender = { value: 202, offender: true }; 
var data = [
  { value: 101 },
  ...
  offender,
  ...
  { value: 200 }
];

var regressions = regression(data);
//=>
[{
  regressor: {
    source: { ... },
    backAnalysis: { ... },
    foreAnalysis: { ... },
    tValue: 468.0...
  },
  previous: { ... },
  next: { ... }
}]

assert( regressions[0].regressor.source === offender );
```
## API

```js
@type Function
@param Array<{ value: Number }>
@returns Array<{ regressor: Object, previous: Object, next: Object }>
```

The API for this module is a single function which accepts a single array as 
input. This array should contain objects with a `value` property. For example:

```js
var param = [
  { value: 100 }
]
```

The API will return a new array containing regression offenders along with their 
adjacent array members, and all relevant regression metadata. The source object 
is accessible in each regression entry in the `source` property.

#### Evaluating the response

Using the following example response as a guide:

```js
[ { regressor:
   { source: { value: 202, offender: true },
     backAnalysis: { length: 12, average: 101.5, variance: 0.2727272727272727 },
     foreAnalysis: { length: 12, average: 201.5, variance: 0.2727272727272727 },
     tValue: 468.01974568701814 },
  previous:
   { source: { value: 101, offender: false },
     backAnalysis: { length: 12, average: 101.5, variance: 0.2727272727272727 },
     foreAnalysis:
      { length: 12,
        average: 193.16666666666666,
        variance: 842.6969696969695 },
     tValue: 9.773584847914274 },
  next:
   { source: { value: 201 },
     backAnalysis:
      { length: 12,
        average: 109.83333333333333,
        variance: 842.6969696969696 },
     foreAnalysis: { length: 12, average: 201.5, variance: 0.2727272727272727 },
     tValue: 9.773584847914275 } } ]
```

* The response is always an array of regressions. If no regressions are detected, the array will be empty.
* Every regression has three properties: `regressor`, `previous`, and `next`.
  * The `regressor` property contains the analysis information for the array entry which introduced a detectable change point.
  * The `previous` property contains the analysis information for the array entry prior to the `regressor`.
  * The `next` property contains the analysis information for the array entry after the `regressor`.
* Each of the regression sub-objects contains the following properties: `source`, `backAnalysis`, `foreAnalysis`, and `tValue`.
  * The `source` property is a reference to the original object for which an analysis was performed on. This object is not mutated and any extraneous properties on the object have no effect.
  * The `backAnalysis` contains an object which represents the statistical information for the window leading up to the `source`.
  * The `foreAnalysis` contains an object which represents the statistical information for the window appearing after the `source`.
  * The `tValue` is the normalized T-test score for the backward and forward windows. This number is the determinant for a detectable change point.
