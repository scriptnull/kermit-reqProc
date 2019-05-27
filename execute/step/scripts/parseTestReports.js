'use strict';
var self = parseTestReports;
module.exports = self;

var fs = require('fs');
var executeScript = require('./executeScript.js');
var path = require('path');

var _ = require('underscore');

function parseTestReports(externalBag, callback) {

  var templatePath = path.resolve(__dirname,
    util.format('%s/templates/parseReport.%s',
      global.config.shippableNodeOperatingSystem,
      global.config.scriptExtension
    )
  );

  var bag = {
    templatePath: templatePath,
    scriptPath: path.resolve(externalBag.stepWorkspacePath, 'parseReport.sh'),
    baseDir: externalBag.baseDir,
    stepWorkspacePath: externalBag.stepWorkspacePath,
    builderApiAdapter: externalBag.builderApiAdapter,
    stepConsoleAdapter: externalBag.stepConsoleAdapter
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

  if (!bag.stepWorkspacePath)
    consoleErrors.push(
      util.format('%s is missing: stepWorkspacePath', who)
    );

  if (!bag.baseDir)
    consoleErrors.push(
      util.format('%s is missing: baseDir', who)
    );

  if (!bag.scriptPath)
    consoleErrors.push(
      util.format('%s is missing: scriptPath', who)
    );

  if (consoleErrors.length > 0) {
    _.each(consoleErrors,
      function (e) {
        var msg = e;
        logger.error(bag.who, e);
        bag.stepConsoleAdapter.publishMsg(msg);
      }
    );
    bag.stepConsoleAdapter.closeCmd(false);
    return next(true);
  }
  bag.stepConsoleAdapter.publishMsg('All parameters present.');
  return next();
}

function _generateScript(bag, next) {
  var who = bag.who + '|' + _generateScript.name;
  logger.debug(who, 'Inside');

  var params = {
    stepWorkspaceDir: bag.stepWorkspacePath,
    baseDir: bag.baseDir
  };

  var scriptContent =
    fs.readFileSync(bag.templatePath).toString();
  var template = _.template(scriptContent);
  bag.script = template(params);
  bag.stepConsoleAdapter.publishMsg('Successfully generated script');

  return next();
}

function _writeScript(bag, next) {
  var who = bag.who + '|' + _writeScript.name;
  logger.debug(who, 'Inside');

  fs.writeFile(bag.scriptPath, bag.script,
    function (err) {
      var msg;
      if (err) {
        msg = util.format('%s, Failed to save script %s, %s',
          who, bag.scriptPath, err);
        bag.stepConsoleAdapter.publishMsg(msg);
        bag.stepConsoleAdapter.closeCmd(false);
        return next(err);
      }

      fs.chmodSync(bag.scriptPath, '755');
      bag.stepConsoleAdapter.publishMsg('Successfully saved script');
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
    builderApiAdapter: bag.builderApiAdapter,
    stepConsoleAdapter: bag.stepConsoleAdapter,
    ignoreCmd: true
  };

  executeScript(scriptBag,
    function (err) {
      if (err)
        logger.error(who, 'Failed to execute task', err);
      return next(err);
    }
  );
}
