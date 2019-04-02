'use strict';
var self = executeDependencyScript;
module.exports = self;

var fs = require('fs');
var executeScript = require('./executeScript.js');

function executeDependencyScript(externalBag, callback) {

  var bag = {
    dependency: externalBag.dependency,
    templatePath: externalBag.templatePath,
    scriptPath: externalBag.scriptPath,
    parentGroupDescription: externalBag.parentGroupDescription,
    builderApiAdapter: externalBag.builderApiAdapter
  };

  bag.who = util.format('%s|step|handlers|%s', msName, self.name);
  logger.verbose(bag.who, 'Starting');

  async.series([
      _checkInputParams.bind(null, bag),
      _generateScript.bind(null, bag),
      _writeScript.bind(null, bag),
      _executeTask.bind(null, bag)
    ],
    function (err) {
      logger.verbose(bag.who, 'Completed');
      return callback(err);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.debug(who, 'Inside');

  var consoleErrors = [];

  if (!bag.dependency)
    consoleErrors.push(
      util.format('%s is missing: dependency', who)
    );

  if (!bag.templatePath)
    consoleErrors.push(
      util.format('%s is missing: templatePath', who)
    );

  if (!bag.scriptPath)
    consoleErrors.push(
      util.format('%s is missing: scriptPath', who)
    );

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

function _generateScript(bag, next) {
  var who = bag.who + '|' + _generateScript.name;
  logger.debug(who, 'Inside');

  var scriptContent =
    fs.readFileSync(bag.templatePath).toString();
  var template = _.template(scriptContent);
  bag.script = template(bag.dependency);
  return next();
}

function _writeScript(bag, next) {
  var who = bag.who + '|' + _writeScript.name;
  logger.debug(who, 'Inside');

  fs.writeFile(bag.scriptPath, bag.script,
    function (err) {
      if (err) {
        return next(err);
      }

      fs.chmodSync(bag.scriptPath, '755');
      return next();
    }
  );
}

function _executeTask(bag, next) {
  var who = bag.who + '|' + _executeTask.name;
  logger.debug(who, 'Inside');

  var scriptBag = {
    scriptPath: bag.scriptPath,
    args: [],
    options: {},
    parentGroupDescription: bag.parentGroupDescription,
    builderApiAdapter: bag.builderApiAdapter,
    ignoreCmd: true
  };

  executeScript(scriptBag,
    function (err) {
      if (err)
        logger.error(who, 'Failed to execute dependency task', err);
      return next(err);
    }
  );
}
