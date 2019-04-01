'use strict';

var self = createFiles;
module.exports = self;

var fs = require('fs-extra');

function createFiles(externalBag, callback) {
  var bag = {
    filesToBeCreated: externalBag.filesToBeCreated
  };
  bag.who = util.format('%s|common|helpers|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _createFiles.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to create files'));
      else
        logger.info(bag.who, util.format('Successfully created files'));

      return callback(err);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'filesToBeCreated'
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

function _createFiles(bag, next) {
  var who = bag.who + '|' + _createFiles.name;
  logger.verbose(who, 'Inside');

  async.eachLimit(bag.filesToBeCreated, 10,
    function (file, nextFile) {
      fs.ensureFile(file,
        function (err) {
          if (err) {
            return nextFile(err);
          }

          return nextFile();
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
