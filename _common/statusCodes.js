'use strict';

// ANY CHANGES MADE TO THIS MUST BE DOCUMENTED HERE:
// https://github.com/Shippable/slack/wiki/Build-status-codes

 /** Status Codes:
  * 4005 -- WAITING -------- Initial state.
  * 4000 -- QUEUED --------- Between initial state and in progress state.
  * 4001 -- PROCESSING ----- In progress state.
  * 4002 -- SUCCESS ----+
  * 4008 -- SKIPPED     |
  * 4007 -- UNSTABLE    +--- Completed states.
  * 4009 -- TIMEOUT     |
  * 4006 -- CANCELED    |
  * 4003 -- FAILED      |
  * 4010 -- STOPPED     |
  * 4011 -- DELETED     |
  * 4012 -- CACHED  ----+
  **/

// Incomplete states:
exports.WAITING    = 4005;
exports.QUEUED     = 4000;
exports.PROCESSING = 4001;

// Completed states:
exports.SUCCESS    = 4002;
exports.SKIPPED    = 4008;
exports.UNSTABLE   = 4007;
exports.TIMEOUT    = 4009;
exports.CANCELED   = 4006;
exports.FAILED     = 4003;
exports.STOPPED    = 4010;
exports.DELETED    = 4011;
exports.CACHED     = 4012;

exports.names = [
  'WAITING', 'QUEUED', 'PROCESSING',
  'SUCCESS', 'SKIPPED', 'UNSTABLE',
  'TIMEOUT', 'CANCELED', 'FAILED',
  'STOPPED', 'DELETED', 'CACHED'
];

// Lookup status code name from code.
exports.lookup = function (code, subset) {
  var statusCodes = (subset || this || exports),
      matchingName = null;
  statusCodes.names.some(function (statusCodeName) {
    if (statusCodes[statusCodeName] === code) {
      return (matchingName = statusCodeName);
    }
  });
  return matchingName;
};

// Subset of idle status codes.
exports.idle = createSubset('WAITING', 'QUEUED');

exports.processing = createSubset('PROCESSING');

// Subset of incomplete status codes.
exports.incomplete = createSubset('WAITING', 'QUEUED', 'PROCESSING');

exports.started = createSubset('QUEUED', 'PROCESSING');

// Subset of complete status codes.
exports.complete = createSubset(
  'SUCCESS', 'SKIPPED', 'UNSTABLE',
  'TIMEOUT', 'CANCELED', 'FAILED',
  'STOPPED'
);

// Subset of successfully completed status code.
exports.successful = createSubset('SUCCESS', 'SKIPPED', 'STOPPED', 'DELETED');

// Subset of unsuccessfully completed status codes.
exports.unsuccessful =
  createSubset('UNSTABLE', 'TIMEOUT', 'CANCELED', 'FAILED');

// Subset of valid build group status codes.
exports.buildGroup = createSubset(
  'WAITING', 'PROCESSING',
  'SUCCESS', 'SKIPPED',
  'CANCELED', 'FAILED'
);

// Check if status code is a in progress or pending code.
exports.pendingLookup = function (code) {
  return !!exports.incomplete.lookup(code);
};

exports.idleLookup = function (code) {
  return !!exports.idle.lookup(code);
};

exports.processingLookup = function (code) {
  return !!exports.processing.lookup(code);
};

// Check if status code is a complete status code.
exports.completedLookup = function (code) {
  return !!exports.complete.lookup(code);
};

// Check if status code is a failed status code.
exports.failedLookup = function (code) {
  return !!exports.unsuccessful.lookup(code);
};

// Check if status code is a successful status code.
exports.successLookup = function (code) {
  return !!exports.successful.lookup(code);
};

// Get a list of status codes from their names.
exports.extractList = function (statusNames) {
  var statusCodes = [];
  statusNames.forEach(function (statusName) {
    if (typeof exports[statusName] === 'number') {
      statusCodes.push(exports[statusName]);
    }
  });
  return statusCodes;
};

// Creates a status code subset.
function createSubset(/*subsetStatusCodeNames...*/) {
  var statusCodeSubset = {},
    statusNames = Array.prototype.slice.call(arguments, 0);
  statusCodeSubset.names = statusNames;
  statusNames.forEach(function (statusName) {
    statusCodeSubset[statusName] = exports[statusName];
  });
  statusCodeSubset.lookup = exports.lookup;
  return statusCodeSubset;
}
