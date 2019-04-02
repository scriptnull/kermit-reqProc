'use strict';

var self = executeStep;
module.exports = self;

var fs = require('fs-extra');
var path = require('path');

var StepConsoleAdapter =
  require('../_common/shippable/stepConsole/stepConsoleAdapter.js');

var prepData = require('./step/prepData.js');
var pollStepStatus = require('./step/pollStepStatus.js');
var setupDirectories = require('./step/setupDirectories.js');
var constructStepJson = require('./step/constructStepJson.js');
var processINs = require('./step/processINs.js');

function executeStep(externalBag, callback) {
  var bag = {
    step: externalBag.step,
    builderApiAdapter: externalBag.builderApiAdapter,
    runtimeTemplate: externalBag.runtimeTemplate,
    runDir: externalBag.runDir,
    stepJsonPath:
      path.join(externalBag.runDir, externalBag.step.name, 'step.json'),
    error: false
  };

  bag.who = util.format('%s|execute|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _getSteplets.bind(null, bag),
      _initializeStepConsoleAdapter.bind(null, bag),
      _prepData.bind(null, bag),
      _setupDirectories.bind(null, bag),
      _pollStepStatus.bind(null, bag),
      _setExecutorAsReqProc.bind(null, bag),
      _constructStepJson.bind(null, bag),
      _addStepJson.bind(null, bag),
      _processINs.bind(null, bag),
      _closeSetupGroup.bind(null, bag)
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
        bag.error = true;
        return next();
      }

      bag.stepletsByStepId = _.groupBy(steplets, 'stepId');
      return next();
    }
  );
}

function _initializeStepConsoleAdapter(bag, next) {
  if (bag.error) return next();

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
  if (bag.error) return next();

  var who = bag.who + '|' + _prepData.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.openGrp('Setup');

  // We don't know where the group will end so need a flag
  bag.isSetupGrpSuccess = true;

  bag.stepId = bag.step.id;

  prepData(bag,
    function (err, resultBag) {
      if (err) {
        bag.error = true;
        return next();
      }

      bag = _.extend(bag, resultBag);
      return next();
    }
  );
}

function _setupDirectories(bag, next) {
  if (bag.error) return next();

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
    resDirToBeCreated: resDirToBeCreated,
    stepJsonPath: bag.stepJsonPath
  };

  setupDirectories(innerBag,
    function (err, resultBag) {
      if (err) {
        bag.error = true;
        return next();
      }

      bag = _.extend(bag, resultBag);
      return next();
    }
  );
}

function _pollStepStatus(bag, next) {
  if (bag.error) return next();

  var who = bag.who + '|' + _pollStepStatus.name;
  logger.verbose(who, 'Inside');

  var innerBag = {
    builderApiAdapter: bag.builderApiAdapter,
    stepId: bag.step.id,
    stepConsoleAdapter: bag.stepConsoleAdapter,
    runDir: bag.runDir
  };

  pollStepStatus(innerBag,
    function (err) {
      if (err) {
        bag.isSetupGrpSuccess = false;
        bag.error = true;
      }

      return next();
    }
  );
}

function _setExecutorAsReqProc(bag, next) {
  if (bag.error) return next();

  var who = bag.who + '|' + _setExecutorAsReqProc.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.openCmd('Setting executor as reqProc');

  var whoPath = path.join(bag.runDir, 'status', 'step.who');
  fs.writeFile(whoPath, 'reqProc\n',
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed to write file: %s ' +
          'with err: %s', who, whoPath, err);
        bag.stepConsoleAdapter.publishMsg(msg);
        bag.stepConsoleAdapter.closeCmd(false);
        bag.isSetupGrpSuccess = false;
        bag.error = true;
        return next();
      }

      bag.stepConsoleAdapter.publishMsg(
        util.format('Updated %s', whoPath)
      );

      bag.stepConsoleAdapter.closeCmd(true);
      return next();
    }
  );
}

function _constructStepJson(bag, next) {
  if (bag.error) return next();

  var who = bag.who + '|' + _constructStepJson.name;
  logger.verbose(who, 'Inside');

  var innerBag = {
    runResourceVersions: bag.runResourceVersions,
    runStepConnections: bag.runStepConnections,
    integrations: bag.integrations,
    step: bag.step
  };

  constructStepJson(innerBag,
    function (err, resultBag) {
      if (err) {
        bag.error = true;
        return next();
      }

      bag = _.extend(bag, resultBag);
      return next();
    }
  );
}

function _addStepJson(bag, next) {
  if (bag.error) return next();

  var who = bag.who + '|' + _addStepJson.name;
  logger.verbose(who, 'Inside');

  fs.writeFile(bag.stepJsonPath, JSON.stringify(bag.stepData),
    function (err) {
      if (err)
        bag.error = true;

      return next();
    }
  );
}

function _processINs(bag, next) {
  if (bag.error) return next();

  var who = bag.who + '|' + _processINs.name;
  logger.verbose(who, 'Inside');

  var innerBag = {
    stepData: bag.stepData,
    stepInDir: bag.stepInDir,
    builderApiAdapter: bag.builderApiAdapter
  };

  processINs(innerBag,
    function (err) {
      if (err)
        bag.error = true;

      return next();
    }
  );
}

function _closeSetupGroup(bag, next) {
  var who = bag.who + '|' + _closeSetupGroup.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.closeGrp(bag.isSetupGrpSuccess);

  return next();
}
