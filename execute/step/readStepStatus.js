'use strict';

var self = readStepStatus;
module.exports = self;

var fs = require('fs-extra');
var path = require('path');

function readStepStatus(externalBag, callback) {
  var bag = {
    stepId: externalBag.stepId,
    builderApiAdapter: externalBag.builderApiAdapter,
    statusDir: externalBag.statusDir,
    stepConsoleAdapter: externalBag.stepConsoleAdapter
  };
  bag.who = util.format('%s|execute|step|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _getStepStatus.bind(null, bag),
      _readStepStatus.bind(null, bag)
    ],
    function (err) {
      var result;
      if (err) {
        logger.error(bag.who, util.format('Failed to read step status'));
      } else {
        logger.info(bag.who, 'Successfully read step status');
        result = {
          statusName: bag.statusName
        };
      }
      return callback(err, result);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'stepId',
    'builderApiAdapter',
    'statusDir',
    'stepConsoleAdapter'
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

  return next(hasErrors);
}


function _getStepStatus(bag, next) {
  var who = bag.who + '|' + _getStepStatus.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.openCmd('Obtaining latest step status');
  bag.builderApiAdapter.getStepById(bag.stepId,
    function (err, step) {
      if (err) {
        var msg = util.format('%s: failed to getStepById' +
          ' for stepId:%s, with err: %s', who, bag.stepId, err);
        logger.warn(msg);
        bag.stepConsoleAdapter.publishMsg(msg);
        bag.stepConsoleAdapter.closeCmd(false);
      } else {
        bag.stepConsoleAdapter.publishMsg(
          util.format('Successfully obtained latest step status: %s',
          global.systemCodesByCode[step.statusCode].name));
        bag.stepConsoleAdapter.closeCmd(true);
        bag.cancelled = step.statusCode ===
          global.systemCodesByName['cancelled'].code;
        bag.statusName = global.systemCodesByCode[step.statusCode].name;
      }

      return next(err);
    }
  );
}

function _readStepStatus(bag, next) {
  if (bag.cancelled) return next();

  var who = bag.who + '|' + _readStepStatus.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.openCmd('Reading step status');

  var statusPath = path.join(bag.statusDir, 'step.status');
  fs.readFile(statusPath, 'utf8',
    function (err, status) {
      var msg;
      if (err) {
        msg = util.format('%s, failed to read file: %s for ' +
          'stepId: %s with err: %s', who, statusPath,
          bag.stepId, err);
        bag.stepConsoleAdapter.publishMsg(msg);
        bag.stepConsoleAdapter.closeCmd(false);
        return next();
      }

      var stepStatusSystemCode = global.systemCodesByName[status.trim()];
      if (_.isEmpty(stepStatusSystemCode)) {
        msg = util.format('%s, failed to find status code for ' +
          'status: %s', who, status.trim());
        bag.stepConsoleAdapter.publishMsg(msg);
        bag.stepConsoleAdapter.closeCmd(false);
        return next();
      }

      bag.statusName = status.trim();
      bag.stepConsoleAdapter.publishMsg(
        'Successfully read step status: ' + status.trim());
      bag.stepConsoleAdapter.closeCmd(true);
      return next();
    }
  );
}
