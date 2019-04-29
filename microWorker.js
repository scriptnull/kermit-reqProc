'use strict';

var self = microWorker;
module.exports = self;

var Adapter = require('./_common/shippable/Adapter.js');
var StepConsoleAdapter =
  require('./_common/shippable/stepConsole/stepConsoleAdapter.js');

var exec = require('child_process').exec;
var path = require('path');

var cleanup = require('./_common/helpers/cleanup.js');
var executeStep = require('./execute/executeStep.js');

function microWorker(message) {
  var bag = {
    rawMessage: message,
    baseDir: global.config.baseDir,
    pipelineDir: path.join(global.config.baseDir, 'pipelines'),
    execTemplatesDir: global.config.execTemplatesDir,
    execTemplatesRootDir: global.config.execTemplatesRootDir,
    completedStepIds: [],
    skippableSteps: []
  };

  bag.who = util.format('%s|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _updateClusterNodeStatus.bind(null, bag),
      _cleanupPipelineDirectory.bind(null, bag),
      _executeStep.bind(null, bag),
      _getSteplets.bind(null, bag),
      _skipSteps.bind(null, bag),
      _skipSteplets.bind(null, bag),
      _postStepLogs.bind(null, bag),
      _cleanupPipelineDirectory.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to process message'));
      else
        logger.info(bag.who, util.format('Successfully processed message'));
      __restartContainer(bag);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  if (_.isEmpty(bag.rawMessage)) {
    logger.warn(util.format('%s, Message is empty.', who));
    return next(true);
  }

  if (!bag.rawMessage.builderApiToken) {
    logger.warn(util.format('%s, No builderApiToken present' +
      ' in incoming message', who));
    return next(true);
  }

  if (_.isEmpty(bag.rawMessage.stepIds)) {
    logger.warn(util.format('%s, Steps are empty in incoming message', who));
    return next(true);
  }

  bag.builderApiToken = bag.rawMessage.builderApiToken;
  bag.builderApiAdapter = new Adapter(bag.rawMessage.builderApiToken);
  bag.stepIds = bag.rawMessage.stepIds;
  return next();
}

function _updateClusterNodeStatus(bag, next) {
  var who = bag.who + '|' + _updateClusterNodeStatus.name;
  logger.verbose(who, 'Inside');

  var update = {
    statusCode: global.systemCodesByName['PROCESSING'].code,
    stepId: bag.stepIds[0]
  };

  bag.builderApiAdapter.putClusterNodeById(global.config.nodeId, update,
    function (err) {
      if (err) {
        logger.warn(util.format('%s, putClusterNodeById for nodeId %s failed ' +
          'with error: %s', bag.who, global.config.nodeId, err));
        return next(true);
      }

      return next();
    }
  );
}

function _cleanupPipelineDirectory(bag, next) {
  var who = bag.who + '|' + _cleanupPipelineDirectory.name;
  logger.verbose(who, 'Inside');

  var innerBag = {
    directory: bag.pipelineDir
  };

  cleanup(innerBag,
    function (err) {
      if (err) {
        logger.warn(util.format('%s, run directory cleanup failed ' +
          'with error: %s', bag.who, err));
        return next(true);
      }
      return next();
    }
  );
}

function _executeStep(bag, next) {
  var who = bag.who + '|' + _executeStep.name;
  logger.verbose(who, 'Inside');

  async.eachSeries(bag.stepIds,
    function (stepId, done) {
      var batchSize = global.systemSettings &&
          global.systemSettings.jobConsoleBatchSize;
      var timeInterval = global.systemSettings &&
        global.systemSettings.jobConsoleBufferTimeIntervalInMS;
      var stepConsoleAdapter = new StepConsoleAdapter(bag.builderApiToken,
        stepId, batchSize, timeInterval);

      var innerBag = {
        who: bag.who,
        stepId: stepId,
        builderApiAdapter: bag.builderApiAdapter,
        stepConsoleAdapter: stepConsoleAdapter,
        baseDir: bag.baseDir,
        execTemplatesDir: bag.execTemplatesDir,
        execTemplatesRootDir: bag.execTemplatesRootDir,
        builderApiToken: bag.builderApiToken,
        badStatus: false,
        completedStepIds: bag.completedStepIds
      };
      async.series([
          __cleanStatus.bind(null, innerBag),
          __execute.bind(null, innerBag),
          __cleanStatus.bind(null, innerBag)
        ],
        function (err) {
          if (err) {
            logger.warn(util.format('%s, ' +
              'failed to execute step %s with error: %s',
              bag.who, innerBag.stepId, err)
            );
          }
          if (innerBag.badStatus)
            bag.skippableSteps = _.difference(bag.stepIds,
              innerBag.completedStepIds);
          return done(innerBag.badStatus);
        }
      );
    },
    function () {
      return next();
    }
  );
}

function __execute(bag, next) {
  var who = bag.who + '|' + __execute.name;
  logger.verbose(who, 'Inside');

  executeStep(bag,
    function (err, badStatus) {
      bag.completedStepIds.push(bag.stepId);
      if (err)
        logger.warn(util.format('%s, step with id %s ended ' +
          'with error: %s', bag.who, bag.stepId, err));
      bag.badStatus = badStatus;
      return next();
    }
  );
}

function __cleanStatus(bag, next) {
  var who = bag.who + '|' + __cleanStatus.name;
  logger.verbose(who, 'Inside');

  var innerBag = {
    directory: path.join(bag.baseDir, 'status')
  };

  cleanup(innerBag,
    function (err) {
      if (err) {
        logger.warn(util.format('%s, status directory cleanup failed ' +
          'with error: %s', bag.who, err));
        return next(true);
      }
      return next();
    }
  );
}

function _getSteplets(bag, next) {
  if (_.isEmpty(bag.skippableSteps)) return next();

  var who = bag.who + '|' + _getSteplets.name;
  logger.verbose(who, 'Inside');

  var query = util.format('stepIds=%s', bag.skippableSteps.join(','));
  bag.builderApiAdapter.getSteplets(query,
    function (err, steplets) {
      if (err)
        logger.warn(util.format('%s, getSteplets failed for stepIds: %s' +
          ' with error: %s', bag.who, bag.skippableSteps.join(','), err));
      bag.skippableSteplets = _.pluck(steplets, 'id');
      return next();
    }
  );
}

function _skipSteps(bag, next) {
  if (_.isEmpty(bag.skippableSteps)) return next();

  var who = bag.who + '|' + _skipSteps.name;
  logger.verbose(who, 'Inside');

  var statusCode = global.systemCodesByName['skipped'].code;
  var update = {
    statusCode: statusCode
  };
  async.eachLimit(bag.skippableSteps, 10,
    function (stepId, done) {

      bag.builderApiAdapter.putStepById(stepId, update,
        function (err) {
          if (err)
            logger.warn(util.format('%s, putStepById failed for stepId: %s' +
              ' with error: %s', bag.who, stepId, err));
          return done();
        }
      );
    },
    function () {
      return next();
    }
  );
}

function _skipSteplets(bag, next) {
  if (_.isEmpty(bag.skippableSteplets)) return next();

  var who = bag.who + '|' + _skipSteplets.name;
  logger.verbose(who, 'Inside');

  var statusCode = global.systemCodesByName['skipped'].code;
  var update = {
    statusCode: statusCode
  };
  async.eachLimit(bag.skippableSteplets, 10,
    function (stepletId, done) {
      bag.builderApiAdapter.putStepletById(stepletId, update,
        function (err) {
          if (err)
            logger.warn(util.format('%s, putStepletById failed for stepletId: ' +
              '%s with error: %s', bag.who, stepletId, err));
          return done();
        }
      );
    },
    function () {
      return next();
    }
  );
}

function _postStepLogs(bag, next) {
  if (_.isEmpty(bag.skippableSteps)) return next();

  var who = bag.who + '|' + _postStepLogs.name;
  logger.verbose(who, 'Inside');

  async.eachLimit(bag.skippableSteps, 10,
    function (stepId, done) {
      var batchSize = global.systemSettings &&
        global.systemSettings.jobConsoleBatchSize;
      var timeInterval = global.systemSettings &&
        global.systemSettings.jobConsoleBufferTimeIntervalInMS;

      var stepConsoleAdapter = new StepConsoleAdapter(bag.builderApiToken,
        stepId, batchSize, timeInterval);
      var grpMsg;
      var logMessage;
      grpMsg = 'Step skipped';
      logMessage = 'Skipping step as it has unsuccessful dependencies.';

      stepConsoleAdapter.openGrp(grpMsg);
      stepConsoleAdapter.openCmd('Info');
      stepConsoleAdapter.publishMsg(logMessage);
      stepConsoleAdapter.closeCmd(false);
      stepConsoleAdapter.closeGrp(false);

      return done();
    },
    function () {
      return next();
    }
  );
}

function __restartContainer(bag) {
  var who = bag.who + '|' + __restartContainer.name;
  logger.verbose(who, 'Inside');

  exec(util.format('docker restart -t=0 %s', config.reqProcContainerName),
    function (err) {
      if (err)
        logger.error(util.format('Failed to stop container with ' +
          'err:%s', err)
        );
    }
  );
}
