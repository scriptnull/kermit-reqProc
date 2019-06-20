'use strict';
var self = validateNode;
module.exports = self;

var exec = require('child_process').exec;
var ShippableAdapter = require('../../shippable/Adapter.js');
var VALIDATION_PERIOD = 2 * 60 * 1000; // 2 minutes

function validateNode(params, callback) {
  if (!config.nodeId) {
    logger.verbose('Skipping node validation as no nodeId is present');
    return callback();
  }

  var bag = {
    params: params,
    adapter: new ShippableAdapter('')
  };

  bag.who = util.format('%s|_common|%s', msName, self.name);
  logger.verbose('Validating node status of nodeId: %s',
    config.nodeId);

  async.series([
      _validateClusterNode.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to validate node status ' +
          'with error: %s', err));
      else
        logger.verbose(bag.who, 'Successfully validated node status');
      return callback(err);
    }
  );
}

function _validateClusterNode(bag, done) {
  var who = bag.who + '|' + _validateClusterNode.name;
  logger.debug(who, 'Inside');

  bag.adapter.validateClusterNodeById(config.nodeId,
    function (err, clusterNode) {
      if (err) {
        logger.warn(who,
          util.format('Failed to :validateClusterNodeById for ' +
            'clusterNodeId: %s', config.nodeId), err
        );
      }

      bag.action = clusterNode && clusterNode.action;
      if (bag.action === 'continue')
        bag.skipAllSteps = true;
      else
        bag.skipAllSteps = false;

      async.series([
          __restartExecContainer.bind(null, bag),
          __stopExecContainer.bind(null, bag)
        ],
        function (err) {
          if (err)
            logger.warn(
              util.format('Unable to perform %s with err:%s', bag.action,
                err)
            );
          else
            logger.debug(who,
              util.format('clusterNodeId:%s action is %s, doing nothing',
                config.nodeId, clusterNode.action)
            );
          if (!global.config.isProcessingStep)
            setTimeout(_validateClusterNode.bind(null, bag),
              VALIDATION_PERIOD);
          if (done)
            return done();
        }
      );
    }
  );
}

function __restartExecContainer(bag, next) {
  if (bag.skipAllSteps) return next();
  if (bag.action !== 'restart') return next();

  var who = bag.who + '|' + __restartExecContainer.name;
  logger.debug(who, 'Inside');

  exec(util.format('docker restart -t=0 %s', config.reqProcContainerName),
    function (err) {
      if (err)
        logger.error(
          util.format('Failed to stop container with err:%s', err)
        );
      return next(err);
    }
  );
}

function __stopExecContainer(bag, next) {
  if (bag.skipAllSteps) return next();
  if (bag.action !== 'shutdown') return next();

  var who = bag.who + '|' + __stopExecContainer.name;
  logger.debug(who, 'Inside');

  exec(util.format('docker stop -t=0 %s', config.reqProcContainerName),
    function (err) {
      if (err)
        logger.error(
          util.format('Failed to stop container with err:%s', err)
        );
      return next(err);
    }
  );
}
