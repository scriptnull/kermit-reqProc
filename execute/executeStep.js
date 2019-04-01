'use strict';

var self = executeStep;
module.exports = self;

var StepConsoleAdapter =
  require('../_common/shippable/stepConsole/stepConsoleAdapter.js');

var prepData = require('./step/prepData.js');
var setupDirectories = require('./step/setupDirectories.js');
var constructStepJson = require('./step/constructStepJson.js');

function executeStep(externalBag, callback) {
  var bag = {
    step: externalBag.step,
    builderApiAdapter: externalBag.builderApiAdapter,
    runtimeTemplate: externalBag.runtimeTemplate,
    runDir: externalBag.runDir
  };

  bag.who = util.format('%s|execute|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _getSteplets.bind(null, bag),
      _initializeStepConsoleAdapter.bind(null, bag),
      _prepData.bind(null, bag),
      _setupDirectories.bind(null, bag),
      _constructStepJson.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to execute step: %s',
          bag.step && bag.step.id));
      else
        logger.info(bag.who, util.format('Successfully executed step'));

      return callback(err);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  if (_.isEmpty(bag.step)) {
    logger.warn(util.format('%s, Step is empty.', who));
    return next(true);
  }

  if (_.isEmpty(bag.builderApiAdapter)) {
    logger.warn(util.format('%s, builderApiAdapter is empty', who));
    return next(true);
  }

  if (_.isEmpty(bag.runtimeTemplate)) {
    logger.warn(util.format('%s, runtimeTemplate is empty.', who));
    return next(true);
  }

  return next();
}

function _getSteplets(bag, next) {
  var who = bag.who + '|' + _getSteplets.name;
  logger.verbose(who, 'Inside');

  var query = util.format('stepIds=%s', bag.step.id);
  bag.builderApiAdapter.getSteplets(query,
    function (err, steplets) {
      if (err) {
        logger.warn(util.format('%s, getSteplets for stepId %s failed ' +
          'with error: %s', bag.who, bag.step.id, err));
        return next(true);
      }

      bag.stepletsByStepId = _.groupBy(steplets, 'stepId');
      return next();
    }
  );
}

function _initializeStepConsoleAdapter(bag, next) {
  var who = bag.who + '|' + _initializeStepConsoleAdapter.name;
  logger.verbose(who, 'Inside');

  var batchSize = global.systemSettings &&
    global.systemSettings.jobConsoleBatchSize;
  var timeInterval = global.systemSettings &&
    global.systemSettings.jobConsoleBufferTimeIntervalInMS;

  bag.stepConsoleAdapter = new StepConsoleAdapter(bag.builderApiToken,
    bag.step.id, batchSize, timeInterval);
  return next();
}

function _prepData(bag, next) {
  var who = bag.who + '|' + _prepData.name;
  logger.verbose(who, 'Inside');

  bag.stepId = bag.step.id;

  prepData(bag,
    function (err, resultBag) {
      if (err) {
        bag.stepStatusCode = global.systemCodesByName['error'].code;
      }
      bag = _.extend(bag, resultBag);
      return next();
    }
  );
}

function _setupDirectories(bag, next) {
  var who = bag.who + '|' + _setupDirectories.name;
  logger.verbose(who, 'Inside');

  var resDirToBeCreated = [];
  _.each(bag.runStepConnections,
    function(runStepConnection) {
      var resource = _.findWhere(bag.runResourceVersions,
        {resourceName: runStepConnection.operationRunResourceName});
      if (resource) {
        resDirToBeCreated.push({
          name: resource.resourceName,
          typeCode: resource.resourceTypeCode,
          operation: runStepConnection.operation
        });
      }
    }
  );

  var innerBag = {
    step: bag.step,
    stepletsByStepId: bag.stepletsByStepId,
    runDir: bag.runDir,
    resDirToBeCreated: resDirToBeCreated
  };

  setupDirectories(innerBag,
    function (err) {
      if (err) {
        bag.stepStatusCode = global.systemCodesByName['error'].code;
      }
      return next();
    }
  );
}

function _constructStepJson(bag, next) {
  var who = bag.who + '|' + _constructStepJson.name;
  logger.verbose(who, 'Inside');

  var innerBag = {
    runResourceVersions: bag.runResourceVersions,
    runStepConnections: bag.runStepConnections,
    integrations: bag.integrations
  };

  constructStepJson(innerBag,
    function (err, resultBag) {
      if (err) {
        bag.stepStatusCode = global.systemCodesByName('error').code;
      }
      bag = _.extend(bag, resultBag);
      return next();
    }
  );
}
