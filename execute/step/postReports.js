'use strict';

var self = postReports;
module.exports = self;

var fs = require('fs-extra');
var path = require('path');
var parseTestReports = require('./scripts/parseTestReports.js');

function postReports(externalBag, callback) {
  var bag = {
    stepData: externalBag.stepData,
    projectId: externalBag.projectId,
    stepWorkspacePath: externalBag.stepWorkspacePath,
    stepConsoleAdapter: externalBag.stepConsoleAdapter,
    builderApiAdapter: externalBag.builderApiAdapter,
    isGrpSuccess: true
  };

  bag.stepConsoleAdapter.openCmd('Processing reports for ' +
    (bag.stepData && bag.stepData.step && bag.stepData.step.name));
  bag.who = util.format('%s|step|%s', msName, self.name);
  logger.info(bag.who, 'Inside');
  async.series([
      _checkInputParams.bind(null, bag),
      _parseTestReport.bind(null, bag),
      _readTestReport.bind(null, bag),
      _postTestReport.bind(null, bag)
    ],
    function (err) {
      if (bag.isGrpSuccess)
        bag.stepConsoleAdapter.closeCmd(true);
      else
        bag.stepConsoleAdapter.closeCmd(false);

      if (err)
        logger.error(bag.who, util.format('Failed to post reports'));
      else
        logger.info(bag.who, 'Successfully posted reports');

      return callback(err);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'stepData',
    'projectId',
    'stepConsoleAdapter',
    'stepWorkspacePath',
    'builderApiAdapter'
  ];

  var paramErrors = [];
  _.each(expectedParams,
    function (expectedParam) {
      if (_.isNull(bag[expectedParam]) || _.isUndefined(bag[expectedParam]))
        paramErrors.push(
          util.format('%s: missing param :%s', who, expectedParam)
        );
    }
  );

  var hasErrors = !_.isEmpty(paramErrors);
  if (hasErrors)
    logger.error(paramErrors.join('\n'));

  bag.step = {
    id: bag.stepData.step.id,
    projectId: bag.projectId,
    name: bag.stepData.step.name
  };

  return next(hasErrors);
}

function _parseTestReport(bag, next) {
  var who = bag.who + '|' + _parseTestReport.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.publishMsg('Parsing test reports');

  var scriptBag = {
    dependency: bag.dependency,
    stepWorkspacePath: bag.stepWorkspacePath,
    builderApiAdapter: bag.builderApiAdapter,
    stepConsoleAdapter: bag.stepConsoleAdapter
  };

  parseTestReports(scriptBag,
    function (err) {
      if (err) {
        logger.error(who,
          util.format('Failed to parse test reports with error: %s', err)
        );
        return next(true);
      }
      logger.debug('Successfully executed script to parse reports');
      return next();
    }
  );
}

function _readTestReport(bag, next) {
  var who = bag.who + '|' + _readTestReport.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.publishMsg('Reading test report file');

  var jsonFilePath = path.join(bag.stepWorkspacePath, 'testresults.json');

  var jsonFile;
  try {
    jsonFile = fs.readFileSync(jsonFilePath).toString();
    // Remove BOM characters which get added in Windows
    // Refer https://github.com/nodejs/node-v0.x-archive/issues/1918
    jsonFile = jsonFile.replace(/^\uFEFF/, '');
  } catch (err) {
    bag.stepConsoleAdapter.publishMsg(
      util.format('Could not read file %s. Skipping.', jsonFilePath));
    return next();
  }

  try {
    bag.testReport = JSON.parse(jsonFile);
  } catch (err) {
    bag.stepConsoleAdapter.publishMsg(
      util.format('Could not parse file %s. Skipping.', jsonFilePath));
    bag.stepConsoleAdapter.closeCmd(false);
    return next();
  }

  bag.stepConsoleAdapter.publishMsg('Successfully parsed test report file.');
  return next();
}

function _postTestReport(bag, next) {
  if (!bag.testReport) return next();

  var who = bag.who + '|' + _postTestReport.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.publishMsg('Posting test report');

  bag.testReport.stepId = bag.step.id;
  bag.testReport.durationSeconds = Math.round(bag.testReport.durationSeconds);

  bag.builderApiAdapter.postStepTestReports(bag.testReport,
    function (err) {
      var msg;
      if (err) {
        msg = util.format('%s, Failed to post test report for ' +
          'stepId: %s', who, bag.step.id, err);

        bag.stepConsoleAdapter.publishMsg(msg);
        bag.stepConsoleAdapter.closeCmd(false);
        bag.isGrpSuccess = false;
        return next(true);
      }

      msg = util.format('Posted test report for stepId: %s ',
        bag.step.id
      );
      bag.stepConsoleAdapter.publishMsg(msg);
      return next();
    }
  );
}
