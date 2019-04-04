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
var createStepletScript = require('./step/createStepletScript.js');
var handOffAndPoll = require('./step/handOffAndPoll.js');
var readJobStatus = require('./step/readJobStatus.js');
var processOUTs = require('./step/processOUTs.js');
var postVersion = require('./step/postVersion.js');

function executeStep(externalBag, callback) {
  var bag = {
    stepId: externalBag.stepId,
    builderApiAdapter: externalBag.builderApiAdapter,
    runtimeTemplate: externalBag.runtimeTemplate,
    runDir: externalBag.runDir,
    execTemplatesDir: externalBag.execTemplatesDir,
    execTemplatesRootDir: externalBag.execTemplatesRootDir,
    builderApiToken: externalBag.builderApiToken,
    error: false
  };

  bag.who = util.format('%s|execute|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _getStep.bind(null, bag),
      _updateStepToProcessing.bind(null, bag),
      _getSteplets.bind(null, bag),
      _initializeStepConsoleAdapter.bind(null, bag),
      _prepData.bind(null, bag),
      _setupDirectories.bind(null, bag),
      _pollStepStatus.bind(null, bag),
      _setExecutorAsReqProc.bind(null, bag),
      _constructStepJson.bind(null, bag),
      _addStepJson.bind(null, bag),
      _processINs.bind(null, bag),
      _createStepletScript.bind(null, bag),
      _closeSetupGroup.bind(null, bag),
      _handOffAndPoll.bind(null, bag),
      _readJobStatus.bind(null, bag),
      _processOUTs.bind(null, bag),
      _postVersion.bind(null, bag),
      _updateStepStatus.bind(null, bag),
      _closeCleanupGroup.bind(null, bag)
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

  if (_.isUndefined(bag.stepId) || _.isNull(bag.stepId)) {
    logger.warn(util.format('%s, stepId is empty.', who));
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

function _getStep(bag, next) {
  var who = bag.who + '|' + _getStep.name;
  logger.verbose(who, 'Inside');

  var query = util.format('stepIds=%s', bag.stepId);
  bag.builderApiAdapter.getSteps(query,
    function (err, steps) {
      if (err) {
        logger.warn(util.format('%s, getSteps for stepId %s failed ' +
          'with error: %s', bag.who, bag.stepId, err));
        bag.error = true;
        return next();
      }

      if (_.isEmpty(steps)) {
        logger.warn(util.format('%s, steps are empty', bag.who));
        bag.error = true;
        return next();
      }

      bag.step = steps[0];
      bag.stepJsonPath = path.join(bag.runDir, bag.step.name, 'step.json');
      bag.cancelled = global.systemCodesByCode[bag.step.statusCode].name ===
        'cancelled';
      bag.timeout = global.systemCodesByCode[bag.step.statusCode].name ===
        'timeout';
      return next();
    }
  );
}

function _updateStepToProcessing(bag, next) {
  if (bag.error || bag.timeout || bag.cancelled) return next();

  var who = bag.who + '|' + _updateStepToProcessing.name;
  logger.verbose(who, 'Inside');

  var statusCode = global.systemCodesByName['processing'].code;

  var update = {
    statusCode: statusCode
  };
  bag.builderApiAdapter.putStepById(bag.step.id, update,
    function (err) {
      if (err) {
        logger.warn(util.format('%s, putStepById for stepId %s failed ' +
          'with error: %s', bag.who, bag.step.id, err));
        bag.error = true;
        return next();
      }

      return next();

    }
  );
}

function _getSteplets(bag, next) {
  if (bag.error || bag.timeout || bag.cancelled) return next();

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
  if (bag.error || bag.timeout || bag.cancelled) return next();

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
  if (bag.error || bag.timeout || bag.cancelled) return next();

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
        bag.isSetupGrpSuccess = false;
      } else {
        bag = _.extend(bag, resultBag);
      }
      return next();
    }
  );
}

function _setupDirectories(bag, next) {
  if (bag.error || bag.timeout || bag.cancelled) return next();

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
    stepJsonPath: bag.stepJsonPath,
    stepConsoleAdapter: bag.stepConsoleAdapter
  };

  setupDirectories(innerBag,
    function (err, resultBag) {
      if (err) {
        bag.error = true;
        bag.isSetupGrpSuccess = false;
      } else {
        bag = _.extend(bag, resultBag);
      }
      return next();
    }
  );
}

function _pollStepStatus(bag, next) {
  if (bag.error || bag.timeout || bag.cancelled) return next();

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
  if (bag.error || bag.timeout || bag.cancelled) return next();

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
  if (bag.error || bag.timeout || bag.cancelled) return next();

  var who = bag.who + '|' + _constructStepJson.name;
  logger.verbose(who, 'Inside');

  var innerBag = {
    runResourceVersions: bag.runResourceVersions,
    runStepConnections: bag.runStepConnections,
    integrations: bag.integrations,
    step: bag.step,
    stepConsoleAdapter: bag.stepConsoleAdapter
  };

  constructStepJson(innerBag,
    function (err, resultBag) {
      if (err) {
        bag.error = true;
        bag.isSetupGrpSuccess = false;
      } else {
        bag = _.extend(bag, resultBag);
      }

      return next();
    }
  );
}

function _addStepJson(bag, next) {
  if (bag.error || bag.timeout || bag.cancelled) return next();

  var who = bag.who + '|' + _addStepJson.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.openCmd('Writing step.json to file');
  fs.writeFile(bag.stepJsonPath, JSON.stringify(bag.stepData),
    function (err) {
      if (err) {
        bag.stepConsoleAdapter.closeCmd(false);
        bag.isSetupGrpSuccess = false;
        bag.error = true;
      } else {
        bag.stepConsoleAdapter.publishMsg('Successfully saved step.json at: ' +
          bag.stepJsonPath);
        bag.stepConsoleAdapter.closeCmd(true);
      }
      return next();
    }
  );
}

function _processINs(bag, next) {
  if (bag.error || bag.timeout || bag.cancelled) return next();

  var who = bag.who + '|' + _processINs.name;
  logger.verbose(who, 'Inside');

  var innerBag = {
    stepData: bag.stepData,
    stepInDir: bag.stepInDir,
    builderApiAdapter: bag.builderApiAdapter,
    stepConsoleAdapter: bag.stepConsoleAdapter
  };

  processINs(innerBag,
    function (err) {
      if (err) {
        bag.isSetupGrpSuccess = false;
        bag.error = true;
      }
      return next();
    }
  );
}

function _createStepletScript(bag, next) {
  if (bag.error || bag.timeout || bag.cancelled) return next();

  var who = bag.who + '|' + _createStepletScript.name;
  logger.verbose(who, 'Inside');

  var innerBag = {
    stepData: bag.stepData,
    execTemplatesRootDir: bag.execTemplatesRootDir,
    stepletScriptPath: bag.stepletScriptPaths[0],
    builderApiToken: bag.builderApiToken,
    stepletId: bag.stepletsByStepId[bag.step.id][0].id,
    runStatusDir: path.join(bag.runDir, 'status'),
    stepletDir: path.join(bag.runDir, bag.step.name,
      bag.stepletsByStepId[bag.step.id][0].id.toString())
  };

  createStepletScript(innerBag,
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

  bag.stepConsoleAdapter.closeGrp(bag.isSetupGrpSuccess);
  return next();
}

function _handOffAndPoll(bag, next) {
  if (bag.error || bag.timeout || bag.cancelled) return next();

  var who = bag.who + '|' + _handOffAndPoll.name;
  logger.verbose(who, 'Inside');

  var innerBag = {
    runStatusDir: path.join(bag.runDir, 'status'),
    stepConsoleAdapter: bag.stepConsoleAdapter
  };
  handOffAndPoll(innerBag,
    function (err) {
      if (err) {
        bag.error = true;
      }
      return next();
    }
  );
}

function _readJobStatus(bag, next) {
  if (bag.error || bag.timeout || bag.cancelled) return next();

  var who = bag.who + '|' + _readJobStatus.name;
  logger.verbose(who, 'Inside');

  var innerBag = {
    runStatusDir: path.join(bag.runDir, 'status'),
    stepConsoleAdapter: bag.stepConsoleAdapter,
    stepId: bag.step.id,
    builderApiAdapter: bag.builderApiAdapter
  };
  readJobStatus(innerBag,
    function (err, resultBag) {
      if (err) {
        bag.error = true;
      }

      var statusName = resultBag.statusName;
      if (statusName === 'error')
        bag.error = true;
      else if (statusName === 'timeout')
        bag.timeout = true;
      else if (statusName === 'cancelled')
        bag.cancelled = true;
      return next();
    }
  );
}

function _processOUTs(bag, next) {
  if (bag.error || bag.timeout || bag.cancelled) return next();

  // This is required because a group is created
  // no matter what the job status is.
  // And should probably move up when more functions are added.
  bag.stepConsoleAdapter.openGrp('Cleanup');

  // We don't know where the group will end so need a flag
  bag.isCleanupGrpSuccess = true;

  var who = bag.who + '|' + _processOUTs.name;
  logger.verbose(who, 'Inside');

  var innerBag = {
    stepData: bag.stepData,
    stepOutDir: bag.stepOutDir,
    builderApiAdapter: bag.builderApiAdapter,
    stepConsoleAdapter: bag.stepConsoleAdapter
  };
  processOUTs(innerBag,
    function (err) {
      if (err) {
        bag.isCleanupGrpSuccess = false;
        bag.error = true;
      }
      return next();
    }
  );
}

function _postVersion(bag, next) {
  if (bag.error || bag.timeout || bag.cancelled) return next();

  var who = bag.who + '|' + _postVersion.name;
  logger.verbose(who, 'Inside');

  var innerBag = {
    stepData: bag.stepData,
    stepConsoleAdapter: bag.stepConsoleAdapter,
    stepOutDir: bag.stepOutDir,
    builderApiAdapter: bag.builderApiAdapter
  };
  postVersion(innerBag,
    function (err) {
      if (err) {
        bag.error = true;
        bag.isCleanupGrpSuccess = false;
      }
      return next();
    }
  );
}

function _updateStepStatus(bag, next) {
  if (bag.cancelled || bag.timeout) return next();

  var who = bag.who + '|' + _postVersion.name;
  logger.verbose(who, 'Inside');

  var statusCode = global.systemCodesByName['success'].code;
  if (bag.error)
    statusCode = global.systemCodesByName['error'].code;
  else if (bag.failure)
    statusCode = global.systemCodesByName['failure'].code;

  var update = {
    statusCode: statusCode
  };
  bag.builderApiAdapter.putStepById(bag.step.id, update,
    function (err) {
      if (err)
        bag.isCleanupGrpSuccess = false;

      return next();

    }
  );
}

function _closeCleanupGroup(bag, next) {
  var who = bag.who + '|' + _closeCleanupGroup.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.closeGrp(bag.isCleanupGrpSuccess);

  return next();
}
