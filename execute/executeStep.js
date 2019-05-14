'use strict';

var self = executeStep;
module.exports = self;

var fs = require('fs-extra');
var path = require('path');

var prepData = require('./step/prepData.js');
var pollStepStatus = require('./step/pollStepStatus.js');
var setupDirectories = require('./step/setupDirectories.js');
var constructStepJson = require('./step/constructStepJson.js');
var decryptSecureEnvs = require('./step/decryptSecureEnvs.js');
var createDependencyScripts = require('./step/createDependencyScripts.js');
var createStepletScript = require('./step/createStepletScript.js');
var handOffAndPoll = require('./step/handOffAndPoll.js');
var readStepStatus = require('./step/readStepStatus.js');
var postReports = require('./step/postReports.js');
var uploadArtifacts = require('./step/uploadArtifacts.js');
var downloadArtifacts = require('./step/downloadArtifacts.js');
var postVersion = require('./step/postVersion.js');

function executeStep(externalBag, callback) {
  var bag = {
    stepId: externalBag.stepId,
    builderApiAdapter: externalBag.builderApiAdapter,
    baseDir: externalBag.baseDir,
    stepConsoleAdapter: externalBag.stepConsoleAdapter,
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
      _prepData.bind(null, bag),
      _setupDirectories.bind(null, bag),
      _pollStepStatus.bind(null, bag),
      _setExecutorAsReqProc.bind(null, bag),
      _constructStepJson.bind(null, bag),
      _decryptSecureEnvs.bind(null, bag),
      _addStepJson.bind(null, bag),
      _downloadArtifacts.bind(null, bag),
      _createDependencyScripts.bind(null, bag),
      _createStepletScript.bind(null, bag),
      _closeSetupGroup.bind(null, bag),
      _handOffAndPoll.bind(null, bag),
      _readStepStatus.bind(null, bag),
      _postReports.bind(null, bag),
      _uploadArtifacts.bind(null, bag),
      _postVersion.bind(null, bag),
      _updateStepStatus.bind(null, bag),
      _closeCleanupGroup.bind(null, bag),
      _postPendingStepConsoles.bind(null, bag),
      _updateStepPendingLogsComplete.bind(null, bag)
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
      bag.cancelled = global.systemCodesByCode[bag.step.statusCode].name ===
        'cancelled';
      bag.timeout = global.systemCodesByCode[bag.step.statusCode].name ===
        'timeout';
      bag.projectId = steps[0].projectId;
      return next();
    }
  );
}

function _updateStepToProcessing(bag, next) {
  if (bag.error || bag.timeout || bag.cancelled) return next();

  var who = bag.who + '|' + _updateStepToProcessing.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.openGrp('Setup');

  // We don't know where the group will end so need a flag
  bag.isSetupGrpSuccess = true;

  bag.stepConsoleAdapter.openCmd('Updating step status to processing');
  var statusCode = global.systemCodesByName['processing'].code;

  var timeoutAt = new Date();
  timeoutAt.setSeconds(timeoutAt.getSeconds() +
    bag.step.configPropertyBag.timeoutSeconds);

  var update = {
    statusCode: statusCode,
    startedAt: new Date(),
    timeoutAt: timeoutAt
  };
  bag.builderApiAdapter.putStepById(bag.step.id, update,
    function (err) {
      if (err) {
        var msg = util.format('%s, putStepById for stepId %s failed ' +
          'with error: %s', bag.who, bag.step.id, err);
        logger.warn(msg);
        bag.stepConsoleAdapter.publishMsg(msg);
        bag.stepConsoleAdapter.closeCmd(false);
        bag.isSetupGrpSuccess = false;
        bag.error = true;
        return next();
      }
      bag.stepConsoleAdapter.publishMsg(
        'Successfully updated step status to processing for stepId: ' +
        bag.step.id);
      bag.stepConsoleAdapter.closeCmd(true);
      return next();

    }
  );
}

function _getSteplets(bag, next) {
  if (bag.error || bag.timeout || bag.cancelled) return next();

  var who = bag.who + '|' + _getSteplets.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.openCmd('Fetching steplets');

  var query = util.format('stepIds=%s', bag.step.id);
  bag.builderApiAdapter.getSteplets(query,
    function (err, steplets) {
      if (err) {
        var msg = util.format('%s, getSteplets for stepId %s failed ' +
          'with error: %s', bag.who, bag.step.id, err);
        logger.warn(msg);
        bag.stepConsoleAdapter.publishMsg(msg);
        bag.stepConsoleAdapter.closeCmd(false);
        bag.isSetupGrpSuccess = false;
        bag.error = true;
        return next();
      }
      bag.stepConsoleAdapter.publishMsg(
        'Successfully fetched steplets for stepId: ' + bag.step.id);
      bag.stepConsoleAdapter.closeCmd(true);
      bag.stepletsByStepId = _.groupBy(steplets, 'stepId');
      return next();
    }
  );
}


function _prepData(bag, next) {
  if (bag.error || bag.timeout || bag.cancelled) return next();

  var who = bag.who + '|' + _prepData.name;
  logger.verbose(who, 'Inside');

  bag.stepId = bag.step.id;
  bag.pipelineId = bag.step.pipelineId;

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
  bag.runDir = path.join(bag.baseDir, 'pipelines', bag.pipeline.name,
    'runs', bag.step.runId.toString());
  bag.stepDir = path.join(bag.runDir, 'steps', bag.step.name);
  bag.stepWorkspacePath = path.join(bag.stepDir, 'workspace');
  bag.runWorkspacePath = path.join(bag.runDir, 'workspace');
  bag.stepJsonPath = path.join(bag.stepDir, 'step.json');
  bag.statusDir = path.join(bag.baseDir, 'status');

  var resDirToBeCreated = [];
  _.each(bag.runStepConnections,
    function(runStepConnection) {
      var resource = _.findWhere(bag.runResourceVersions,
        {resourceName: runStepConnection.operationRunResourceVersionName});
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
    statusDir: bag.statusDir,
    stepDir: bag.stepDir,
    resDirToBeCreated: resDirToBeCreated,
    stepJsonPath: bag.stepJsonPath,
    stepWorkspacePath: bag.stepWorkspacePath,
    runWorkspacePath: bag.runWorkspacePath,
    stepConsoleAdapter: bag.stepConsoleAdapter,
    execTemplatesRootDir: bag.execTemplatesRootDir
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
    statusDir: bag.statusDir
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

  var whoPath = path.join(bag.statusDir, 'step.who');
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
    stepDir: bag.stepDir,
    stepConsoleAdapter: bag.stepConsoleAdapter
  };

  constructStepJson(innerBag,
    function (err, resultBag) {
      if (err) {
        bag.error = true;
        bag.isSetupGrpSuccess = false;
      } else {
        bag.stepData = resultBag.stepData;
        bag.stepEnvs = resultBag.stepEnvs;
      }

      return next();
    }
  );
}

function _decryptSecureEnvs(bag, next) {
  if (bag.error || bag.timeout || bag.cancelled) return next();

  if (!bag.stepData.step || !bag.stepData.step.setup ||
    !bag.stepData.step.setup.environmentVariables)
    return next();

  var who = bag.who + '|' + _decryptSecureEnvs.name;
  logger.verbose(who, 'Inside');

  var innerBag = {
    stepData: bag.stepData,
    projectId: bag.projectId,
    stepConsoleAdapter: bag.stepConsoleAdapter,
    builderApiAdapter: bag.builderApiAdapter
  };

  decryptSecureEnvs(innerBag,
    function (err, resultBag) {
      if (err) {
        bag.error = true;
        bag.isSetupGrpSuccess = false;
      } else {
        bag.stepData = resultBag.stepData;
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

function _downloadArtifacts(bag, next) {
  if (bag.step.configPropertyBag && bag.step.configPropertyBag.reset) {
    bag.stepConsoleAdapter.openCmd('Skipping artifact and cache download');
    bag.stepConsoleAdapter.publishMsg('Step triggered with reset.');
    bag.stepConsoleAdapter.closeCmd(true);
    return next();
  }
  var who = bag.who + '|' + _downloadArtifacts.name;
  logger.verbose(who, 'Inside');

  var innerBag = {
    stepData: bag.stepData,
    projectId: bag.projectId,
    stepConsoleAdapter: bag.stepConsoleAdapter,
    stepWorkspacePath: bag.stepWorkspacePath,
    runWorkspacePath: bag.runWorkspacePath,
    builderApiAdapter: bag.builderApiAdapter
  };

  downloadArtifacts(innerBag,
    function (err) {
      if (err) {
        bag.error = true;
        bag.isCleanupGrpSuccess = false;
      }
      return next();
    }
  );
}

function _createDependencyScripts(bag, next) {
  if (bag.error || bag.timeout || bag.cancelled) return next();
  if (bag.stepData && _.isEmpty(bag.stepData.resources)) return next();

  var who = bag.who + '|' + _createDependencyScripts.name;
  logger.verbose(who, 'Inside');

  var innerBag = {
    execTemplatesRootDir: bag.execTemplatesRootDir,
    stepData: bag.stepData,
    stepConsoleAdapter: bag.stepConsoleAdapter
  };

  createDependencyScripts(innerBag,
    function (err, resultBag) {
      if (err) {
        bag.isSetupGrpSuccess = false;
        bag.error = true;
      }

      bag.stepData = resultBag.stepData;
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
    stepEnvs: bag.stepEnvs,
    execTemplatesRootDir: bag.execTemplatesRootDir,
    stepletScriptPath: bag.stepletScriptPaths[0],
    builderApiToken: bag.builderApiToken,
    stepletId: bag.stepletsByStepId[bag.step.id][0].id,
    statusDir: bag.statusDir,
    stepDir: bag.stepDir,
    runDir: bag.runDir,
    stepletDir: path.join(bag.stepDir,
      bag.stepletsByStepId[bag.step.id][0].id.toString()),
    stepConsoleAdapter: bag.stepConsoleAdapter,
    dependencyStateDir: path.join(bag.stepDir, 'dependencyState'),
    outputDir: path.join(bag.stepDir, 'output'),
    stepWorkspacePath: bag.stepWorkspacePath,
    stepJsonPath: bag.stepJsonPath,
    stepId: bag.stepId
  };

  createStepletScript(innerBag,
    function (err) {
      if (err) {
        bag.isSetupGrpSuccess = false;
        bag.error = true;
      }

      return next();
    }
  );
}

function _closeSetupGroup(bag, next) {
if (_.isEmpty(bag.step)) return next();

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
    statusDir: bag.statusDir,
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

function _readStepStatus(bag, next) {
  if (bag.error || bag.timeout || bag.cancelled) return next();

  var who = bag.who + '|' + _readStepStatus.name;
  logger.verbose(who, 'Inside');

  // This is required because a group is created
  // no matter what the job status is.
  // And should probably move up when more functions are added.
  bag.stepConsoleAdapter.openGrp('Cleanup');

  // We don't know where the group will end so need a flag
  bag.isCleanupGrpSuccess = true;

  var innerBag = {
    statusDir: path.join(bag.baseDir, 'status'),
    stepConsoleAdapter: bag.stepConsoleAdapter,
    stepId: bag.step.id,
    builderApiAdapter: bag.builderApiAdapter
  };
  readStepStatus(innerBag,
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
      else if (statusName === 'failure')
        bag.failure = true;
      return next();
    }
  );
}

function _postReports(bag, next) {
  var who = bag.who + '|' + _postReports.name;
  logger.verbose(who, 'Inside');

  var innerBag = {
    stepData: bag.stepData,
    projectId: bag.step.projectId,
    stepConsoleAdapter: bag.stepConsoleAdapter,
    stepWorkspacePath: bag.stepWorkspacePath,
    stepOutDir: bag.stepOutDir,
    baseDir: bag.baseDir,
    builderApiAdapter: bag.builderApiAdapter
  };
  postReports(innerBag,
    function (err) {
      if (err) {
        bag.error = true;
        bag.isCleanupGrpSuccess = false;
      }
      return next();
    }
  );
}

function _uploadArtifacts(bag, next) {
  var who = bag.who + '|' + _uploadArtifacts.name;
  logger.verbose(who, 'Inside');

  var innerBag = {
    stepData: bag.stepData,
    stepConsoleAdapter: bag.stepConsoleAdapter,
    stepWorkspacePath: bag.stepWorkspacePath,
    runWorkspacePath: bag.runWorkspacePath,
    builderApiAdapter: bag.builderApiAdapter
  };

  uploadArtifacts(innerBag,
    function (err) {
      if (err) {
        bag.error = true;
        bag.isCleanupGrpSuccess = false;
      }
      return next();
    }
  );
}

function _postVersion(bag, next) {
  if (bag.error || bag.timeout || bag.cancelled || bag.failure) return next();

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
  if (bag.cancelled || bag.timeout || _.isEmpty(bag.step)) return next();

  var who = bag.who + '|' + _updateStepStatus.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.openCmd('Updating step status');
  var statusCode = global.systemCodesByName['success'].code;
  if (bag.error)
    statusCode = global.systemCodesByName['error'].code;
  else if (bag.failure)
    statusCode = global.systemCodesByName['failure'].code;

  var update = {
    statusCode: statusCode,
    endedAt: new Date()
  };
  bag.builderApiAdapter.putStepById(bag.step.id, update,
    function (err) {
      if (err) {
        var msg = util.format('%s, failed to :putStepById for ' +
          'stepId: %s with err: %s', who, bag.step.id, err);
        bag.stepConsoleAdapter.publishMsg(msg);
        bag.stepConsoleAdapter.closeCmd(false);
        bag.isCleanupGrpSuccess = false;
      } else {
        bag.stepConsoleAdapter.publishMsg(
          util.format('Successfully updated step with status %s',
          global.systemCodesByCode[update.statusCode].name)
        );
        bag.stepConsoleAdapter.closeCmd(true);
      }
      return next();

    }
  );
}

function _closeCleanupGroup(bag, next) {
  if (_.isEmpty(bag.step)) return next();

  var who = bag.who + '|' + _closeCleanupGroup.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.closeGrp(bag.isCleanupGrpSuccess);

  return next();
}

function _postPendingStepConsoles(bag, next) {
  if (_.isEmpty(bag.step)) return next();

  var who = bag.who + '|' + _postPendingStepConsoles.name;
  logger.verbose(who, 'Inside');

  bag.consoleLogsComplete = false;

  var retryOpts = {
    times: 10,
    interval: function (retryCount) {
      return 1000 * Math.pow(2, retryCount);
    }
  };

  async.retry(retryOpts,
    function (callback) {
      var callsPending = 0;
      if (bag.stepConsoleAdapter)
        callsPending = bag.stepConsoleAdapter.getPendingApiCallCount();

      if (callsPending < 1) {
        bag.consoleLogsComplete = true;
        return callback();
      }
      return callback(true);
    },
    function (err) {
      if (err)
        logger.error('Still posting step consoles');
      return next();
    }
  );
}

function _updateStepPendingLogsComplete(bag, next) {
  if (!bag.consoleLogsComplete) return next();
  // All of the consoles should have been posted, but if not the builder token
  // may still be in use.  It will remain until expiration.

  var who = bag.who + '|' + _updateStepPendingLogsComplete.name;
  logger.verbose(who, 'Inside');

  var update = {
    pendingLogsComplete: true
  };

  bag.builderApiAdapter.putStepById(bag.step.id, update,
    function (err) {
      if (err)
        logger.error(err);

      return next();
    }
  );
}
