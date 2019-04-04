'use strict';

var self = setupDirectories;
module.exports = self;

var path = require('path');
var createDirectories = require('../../_common/helpers/createDirectories.js');
var createFiles = require('../../_common/helpers/createFiles.js');
var isDirectory = require('../../_common/helpers/isDirectory.js')

function setupDirectories(externalBag, callback) {
  var bag = {
    step: externalBag.step,
    stepletsByStepId: externalBag.stepletsByStepId,
    runDir: externalBag.runDir,
    resDirToBeCreated: externalBag.resDirToBeCreated,
    dirsToBeCreated: [],
    filesToBeCreated: [],
    stepJsonPath: externalBag.stepJsonPath,
    stepletScriptPaths: [],
    stepConsoleAdapter: externalBag.stepConsoleAdapter
  };
  bag.who = util.format('%s|step|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _setupDirectories.bind(null, bag),
      _createDirectories.bind(null, bag),
      _createFiles.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to setup dirs'));
      else
        logger.info(bag.who, util.format('Successfully setup dirs'));

      var result = {
        stepInDir: bag.stepInDir,
        stepOutDir: bag.stepOutDir,
        stepletScriptPaths: bag.stepletScriptPaths
      };
      return callback(err, result);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'step',
    'stepletsByStepId',
    'runDir',
    'resDirToBeCreated',
    'stepJsonPath',
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

function _setupDirectories(bag, next) {
  var who = bag.who + '|' + _setupDirectories.name;
  logger.verbose(who, 'Inside');

  // Directories to be created
  bag.dirsToBeCreated.push(path.join(bag.runDir, 'workspace'));
  bag.dirsToBeCreated.push(path.join(bag.runDir, bag.step.name));
  bag.dirsToBeCreated.push(path.join(bag.runDir, bag.step.name, 'cache'));
  bag.dirsToBeCreated.push(path.join(bag.runDir, 'status'));
  bag.dirsToBeCreated.push(path.join(
    bag.runDir, bag.step.name, 'dependencyState'));
  bag.dirsToBeCreated.push(path.join(
    bag.runDir, bag.step.name, 'dependencyState', 'resources'));
  bag.dirsToBeCreated.push(path.join(bag.runDir, bag.step.name, 'output'));
  bag.dirsToBeCreated.push(path.join(
    bag.runDir, bag.step.name, 'output', 'resources'));

  // Create directories and files for IN and OUT resources
  _.each(bag.resDirToBeCreated,
    function (resource) {
      if (resource.operation === 'IN') {
        var resourceType = global.systemCodesByCode[resource.typeCode].name;
        if (isDirectory(path.join(global.config.execTemplatesDir,
          'resources', resourceType)))
            bag.dirsToBeCreated.push(
              path.join(bag.runDir, bag.step.name, 'dependencyState',
              'resources', resource.name));
      } else if (resource.operation === 'OUT') {
          bag.dirsToBeCreated.push(
            path.join(bag.runDir, bag.step.name, 'output',
            'resources', resource.name));
          bag.filesToBeCreated.push(path.join(bag.runDir, bag.step.name,
            'output', 'resources', resource.name, resource.name + '.env'));
      }
    }
  );

  // Files to be created
  bag.filesToBeCreated.push(bag.stepJsonPath);
  bag.filesToBeCreated.push(
    path.join(bag.runDir, 'status', 'step.who'));
  bag.filesToBeCreated.push(
    path.join(bag.runDir, 'status', 'step.status'));
  bag.filesToBeCreated.push(
    path.join(bag.runDir, 'status', 'step.env'));

  // Directories and Steps to be created for steplets
  _.each(bag.stepletsByStepId[bag.step.id],
    function (steplet){
      bag.dirsToBeCreated.push(
        path.join(bag.runDir, bag.step.name, steplet.id.toString()));
      bag.filesToBeCreated.push(
        path.join(bag.runDir, bag.step.name, steplet.id.toString(),
        'steplet.json'));

      var stepletScriptPath = path.join(bag.runDir, bag.step.name,
        steplet.id.toString(), 'stepletScript.sh');
      bag.filesToBeCreated.push(stepletScriptPath);
      bag.stepletScriptPaths.push(stepletScriptPath);
    }
  );

  bag.stepInDir = path.join(bag.runDir, bag.step.name, 'dependencyState');
  bag.stepOutDir = path.join(bag.runDir, bag.step.name, 'output');
  return next();
}

function _createDirectories(bag, next) {
  if (_.isEmpty(bag.dirsToBeCreated)) return next();

  var who = bag.who + '|' + _createDirectories.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.openCmd('Creating required directories');
  var innerBag = {
    dirsToBeCreated: bag.dirsToBeCreated
  };

  createDirectories(innerBag,
    function (err) {
      if (err) {
        bag.stepConsoleAdapter.closeCmd(false);
        return next(err);
      }
      _.each(bag.dirsToBeCreated,
        function (dir) {
          bag.stepConsoleAdapter.publishMsg(
            util.format('Created directory: %s', dir)
          );
        }
      );
      bag.stepConsoleAdapter.closeCmd(true);
      return next();
    }
  );
}

function _createFiles(bag, next) {
  if (_.isEmpty(bag.filesToBeCreated)) return next();

  var who = bag.who + '|' + _createFiles.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.openCmd('Creating required files');
  var innerBag = {
    filesToBeCreated: bag.filesToBeCreated
  };

  createFiles(innerBag,
    function (err) {
      if (err) {
        bag.stepConsoleAdapter.closeCmd(false);
        return next(err);
      }
      _.each(bag.filesToBeCreated,
        function (file) {
          bag.stepConsoleAdapter.publishMsg(
            util.format('Created file: %s', file)
          );
        }
      );
      bag.stepConsoleAdapter.closeCmd(true);
      return next();
    }
  );
}
