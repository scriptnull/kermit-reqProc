'use strict';

var self = cleanup;
module.exports = self;

var fs = require('fs-extra');

function cleanup(externalBag, callback) {
  var bag = {
    directory: externalBag.directory
  };
  bag.who = util.format('%s|common|helpers|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _cleanupDirectory.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who,
          util.format('Failed to cleanup directory: %s', bag.directory));
      else
        logger.info(bag.who, 'Successfully cleaned up directory');

      return callback(err);
    }
  );

}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'directory'
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

function _cleanupDirectory(bag, next) {
  var who = bag.who + '|' + _cleanupDirectory.name;
  logger.verbose(who, 'Inside');

  fs.emptyDir(bag.directory,
    function (err) {
      if (err) {
        return next(err);
      }
      return next();
    }
  );
}
