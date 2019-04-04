'use strict';

var self = createStepletScript;
module.exports = self;

var fs = require('fs-extra');

var assemble = require('../../assembler/assemble.js');

function createStepletScript(externalBag, callback) {
  var bag = {
    stepData: externalBag.stepData,
    execTemplatesRootDir: externalBag.execTemplatesRootDir,
    stepletScriptPath: externalBag.stepletScriptPath
  };
  bag.who = util.format('%s|step|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _assembleScript.bind(null, bag),
      _writeScript.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to create stepletScript.sh'));
      else
        logger.info(bag.who, 'Successfully created stepletScript.sh');

      return callback(err);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'stepData',
    'execTemplatesRootDir',
    'stepletScriptPath'
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

function _assembleScript(bag, next) {
  var who = bag.who + '|' + _assembleScript.name;
  logger.verbose(who, 'Inside');

  var innerBag = {
    execTemplatesRootDir: bag.execTemplatesRootDir,
    json: bag.stepData.step,
    objectType: 'steps',
    objectSubType: bag.stepData.step.type
  };

  assemble(innerBag,
    function (err, result) {
      if (err)
        return next(err);

      bag.assembledScript = result.assembledScript;
      return next();
    }
  );
}

function _writeScript(bag, next) {
  var who = bag.who + '|' + _writeScript.name;
  logger.debug(who, 'Inside');

  fs.writeFile(bag.stepletScriptPath, bag.assembledScript,
    function (err) {
      if (err) {
        return next(err);
      }

      fs.chmodSync(bag.stepletScriptPath, '755');
      return next();
    }
  );
}
