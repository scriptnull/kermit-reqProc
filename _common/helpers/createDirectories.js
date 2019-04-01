'use strict';

var self = createDirectories;
module.exports = self;

var fs = require('fs-extra');

function createDirectories(externalBag, callback) {
  var bag = {
    dirsToBeCreated: externalBag.dirsToBeCreated
  };
  bag.who = util.format('%s|common|helpers|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _createDirectories.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to create dirs'));
      else
        logger.info(bag.who, util.format('Successfully created dirs'));

      return callback(err);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'dirsToBeCreated'
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

function _createDirectories(bag, next) {
  var who = bag.who + '|' + _createDirectories.name;
  logger.verbose(who, 'Inside');

  async.eachLimit(bag.dirsToBeCreated, 10,
    function (dir, nextDir) {
      fs.ensureDir(dir,
        function (err) {
          if (err) {
            return nextDir(err);
          }
          return nextDir();
        }
      );
    },
    function (err) {
      if (err) {
        return next(err);
      }
      return next();
    }
  );
}
