'use strict';
var self = updateNodeStatus;
module.exports = self;

var ShippableAdapter = require('../../shippable/Adapter.js');
var statusCodes = require('../../statusCodes.js');

function updateNodeStatus(params, callback) {
  if (!config.nodeId) {
    logger.verbose('Skipping node status update as no nodeId is present');
    return callback();
  }

  var bag = {
    params: params,
    skipStatusUpdate: false
  };

  bag.who = util.format('%s|_common|%s', msName, self.name);
  logger.verbose(bag.who, 'Starting');

  async.series([
      _checkInputParams.bind(null, bag),
      _updateClusterNodeStatus.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, 'Failed to update node status');
      else
        logger.verbose(bag.who, 'Successfully updated node status');
      return callback(err);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.debug(who, 'Inside');

  var consoleErrors = [];
  bag.adapter = new ShippableAdapter('');

  if (consoleErrors.length > 0) {
    _.each(consoleErrors,
      function (e) {
        logger.error(bag.who, e);
      }
    );
    return next(true);
  }
  return next();
}

function _updateClusterNodeStatus(bag, next) {
  if (bag.skipStatusUpdate) return next();

  var who = bag.who + '|' + _updateClusterNodeStatus.name;
  logger.debug(who, 'Inside');

  var update = {
    statusCode: statusCodes.SUCCESS,
    execImage: config.execImage,
    stepId: null
  };

  bag.adapter.putClusterNodeById(config.nodeId,
    update,
    function (err) {
      if (err) {
        logger.error(
          util.format('%s has failed to update status of cluster node %s ' +
            'with err %s', who, config.nodeId, err)
        );
        return next(true);
      }
      return next();
    }
  );
}
