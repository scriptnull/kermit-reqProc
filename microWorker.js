'use strict';

var self = microWorker;
module.exports = self;

var Adapter = require('./_common/shippable/Adapter.js');
var StepConsoleAdapter =
  require('./_common/shippable/stepConsole/stepConsoleAdapter.js');

var exec = require('child_process').exec;

var cleanup = require('./_common/cleanup.js');
var prepData = require('./step/prepData.js');

function microWorker(message) {
  var bag = {
    rawMessage: message,
    runDir: global.config.runDir
  };

  bag.who = util.format('%s|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _updateClusterNodeStatus.bind(null, bag),
      _getClusters.bind(null, bag),
      _getRuntimeTemplates.bind(null, bag),
      _initialRunDirectoryCleanup.bind(null, bag),
      _getSteps.bind(null, bag),
      _getSteplets.bind(null, bag),
      _initializeStepConsoleAdapter.bind(null, bag),
      _prepData.bind(null, bag)
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
    statusCode: global.systemCodesByName['PROCESSING'].code
  };

  bag.builderApiAdapter.putClusterNodeById(global.config.nodeId, update,
    function (err, clusterNode) {
      if (err) {
        logger.warn(util.format('%s, putClusterNodeById for nodeId %s failed ' +
          'with error: %s', bag.who, global.config.nodeId, err));
        return next(true);
      }

      bag.clusterId = clusterNode.clusterId;
      return next();
    }
  );
}

function _getClusters(bag, next) {
  var who = bag.who + '|' + _getClusters.name;
  logger.verbose(who, 'Inside');

  bag.builderApiAdapter.getClusters(util.format('clusterIds=%s', bag.clusterId),
    function (err, clusters) {
      if (err) {
        logger.warn(util.format('%s, getClusters for clusterId %s failed ' +
          'with error: %s', bag.who, bag.clusterId, err));
        return next(true);
      }

      if (_.isEmpty(clusters)) {
        logger.warn(util.format('%s, clusters is empty for clusterIds: %s',
          bag.clusterId));
        return next(true);
      }

      bag.runtimeTemplateId = clusters[0].runtimeTemplateId;
      return next();
    }
  );
}

function _getRuntimeTemplates(bag, next) {
  var who = bag.who + '|' + _getClusters.name;
  logger.verbose(who, 'Inside');

  bag.builderApiAdapter.getRuntimeTemplates(
    util.format('runtimeTeplateIds=%s', bag.runtimeTemplateId),
    function (err, runtimeTemplates) {
      if (err) {
        logger.warn(util.format('%s, getRuntimeTemplates for ' +
          'runtimeTeplateId %s failed with error: %s', bag.who,
          bag.runtimeTeplateId, err));
        return next(true);
      }

      if (_.isEmpty(runtimeTemplates)) {
        logger.warn(util.format('%s, runtimeTemplates is empty for ' +
          'runtimeTemplateIds: %s', bag.clusterId));
        return next(true);
      }

      bag.runtimeTemplate = runtimeTemplates[0];
      return next();
    }
  );
}

function _initialRunDirectoryCleanup(bag, next) {
  var who = bag.who + '|' + _initialRunDirectoryCleanup.name;
  logger.verbose(who, 'Inside');

  var innerBag = {
    directory: bag.runDir
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


function _getSteps(bag, next) {
  var who = bag.who + '|' + _getSteps.name;
  logger.verbose(who, 'Inside');

  var query = util.format('stepIds=%s', bag.stepIds.join(','));
  bag.builderApiAdapter.getSteps(query,
    function (err, steps) {
      if (err) {
        logger.warn(util.format('%s, getSteps for stepId %s failed ' +
          'with error: %s', bag.who, bag.stepIds, err));
        return next(true);
      }

      bag.steps = steps;
      return next();
    }
  );
}

function _getSteplets(bag, next) {
  var who = bag.who + '|' + _getSteplets.name;
  logger.verbose(who, 'Inside');

  var query = util.format('stepIds=%s', bag.stepIds.join(','));
  bag.builderApiAdapter.getSteplets(query,
    function (err, steplets) {
      if (err) {
        logger.warn(util.format('%s, getSteplets for stepId %s failed ' +
          'with error: %s', bag.who, bag.step.id, err));
        return next(true);
      }

      bag.steplets = steplets;
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
    bag.stepIds[0], batchSize, timeInterval);
  return next();
}

function _prepData(bag, next) {
  var who = bag.who + '|' + _prepData.name;
  logger.verbose(who, 'Inside');

  bag.stepId = _.first(bag.stepIds);

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
