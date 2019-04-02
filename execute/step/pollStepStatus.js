'use strict';

var self = pollStepStatus;
module.exports = self;

var fs = require('fs-extra');
var path = require('path');

function pollStepStatus(externalBag, callback) {
  var bag = {
    builderApiAdapter: externalBag.builderApiAdapter,
    stepId: externalBag.stepId,
    stepConsoleAdapter: externalBag.stepConsoleAdapter,
    runDir: externalBag.runDir
  };
  bag.who = util.format('%s|execute|step|%s', msName, self.name);

  async.series([
      _checkInputParams.bind(null, bag),
      _pollStepStatus.bind(null, bag)
    ],
    function () {
      return callback();
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'builderApiAdapter',
    'stepId',
    'stepConsoleAdapter',
    'runDir'
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

function _pollStepStatus(bag, next) {
  var who = bag.who + '|' + _pollStepStatus.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.openCmd('Starting step status poll');
  var isTerminated = false;
  var cancelledStatusCode = global.systemCodesByName['cancelled'].code;
  var timeoutStatusCode = global.systemCodesByName['timeout'].code;
  var statusPath = path.join(bag.runDir, 'status', 'step.status');
  function poll(bag) {
    bag.builderApiAdapter.getStepById(bag.stepId,
      function (err, step) {
        if (err) {
          logger.warn(util.format('%s, Failed to get step for stepId:%s, ' +
            'with err: %s', who, bag.stepId, err));
          return;
        }
        var statusName = global.systemCodesByCode[step.statusCode].name;
        if (step.statusCode === cancelledStatusCode ||
          step.statusCode === timeoutStatusCode) {
          isTerminated = true;
          try {
            fs.writeFileSync(statusPath, util.format('%s\n', statusName));
          } catch (e) {
            logger.warn(who,
              'Failed to write status to status path with error: ', e
            );
            // Reset this so we can try again in the next poll.
            isTerminated = false;
          }
        }

        if (!isTerminated)
          setTimeout(
            function () {
              poll(bag);
            }, global.config.runShJobStatusPollIntervalMS
          );
      }
    );
  }

  poll(bag);
  bag.stepConsoleAdapter.publishMsg(
    'Configured job status poll for every ' +
    global.config.runShJobStatusPollIntervalMS / 1000 + ' seconds');
  bag.stepConsoleAdapter.closeCmd(true);
  return next();
}
