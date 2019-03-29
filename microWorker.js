'use strict';

var self = microWorker;
module.exports = self;

var Adapter = require('./_common/shippable/Adapter.js');
var exec = require('child_process').exec;

function microWorker(message) {
  var bag = {
      rawMessage: message
    };

  bag.who = util.format('%s|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag)
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
  return next();
}

function __restartContainer(bag) {
  var who = bag.who + '|' + __restartContainer.name;
  logger.verbose(who, 'Inside');

  exec(util.format('docker restart -t=0 %s', config.reqProcContainerName),
    function (err) {
      if (err)
        logger.error(util.format('Failed to stop container with ' +
          'err:%s', err));
    }
  );
}
