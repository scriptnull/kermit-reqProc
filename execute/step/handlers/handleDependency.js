'use strict';

var self = handleDependency;
module.exports = self;

function handleDependency(externalBag, dependency, callback) {
  var bag = {
    builderApiAdapter: externalBag.builderApiAdapter,
    stepInDir: externalBag.stepInDir,
    stepOutDir: externalBag.stepOutDir
  };
  bag.who = util.format('%s|step|handlers|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _handleDependency.bind(null, bag, dependency)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to process dependencies'));
      else
        logger.info(bag.who, 'Successfully processed dependencies');

      return callback(err);
    }
  );

}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  return next();
}

function _handleDependency(bag, dependency, next) {
  // We don't know where the group will end so need a flag
  bag.isGrpSuccess = true;

  var who = bag.who + '|' + _handleDependency.name;
  logger.verbose(who, 'Inside');

  var msg = util.format('Processing %s Dependency: %s', dependency.operation,
    dependency.name);

  var pathPlaceholder = '{{TYPE}}';
  var osType = global.config.shippableNodeOperatingSystem;
  var inStepPath = './resources/_common/' + pathPlaceholder + '/inStep.js';
  var outStepPath = './resources/_common/' + pathPlaceholder + '/outStep.js';
  var inStepOSPath =
    './resources/' + osType + '/' + pathPlaceholder + '/inStep.js';
  var outStepOSPath =
    './resources/' + osType + '/' + pathPlaceholder + '/outStep.js';

  var dependencyHandler;
  var dependencyHandlerPath = '';
  var rootDir;

  if (dependency.operation === 'IN') {
    dependencyHandlerPath =
      inStepOSPath.replace(pathPlaceholder, dependency.type);
    rootDir = bag.stepInDir;
  } else if (dependency.operation === 'OUT') {
    dependencyHandlerPath =
      outStepOSPath.replace(pathPlaceholder, dependency.type);
    rootDir = bag.stepOutDir;
  }
  try {
    dependencyHandler = require(dependencyHandlerPath);
  } catch (e) {
    logger.debug(util.inspect(e));
  }

  if (!dependencyHandler) {
    if (dependency.operation === 'IN') {
      dependencyHandlerPath =
        inStepPath.replace(pathPlaceholder, dependency.type);
      rootDir = bag.stepInDir;
    } else if (dependency.operation === 'OUT') {
      dependencyHandlerPath =
        outStepPath.replace(pathPlaceholder, dependency.type);
      rootDir = bag.stepInDir;
    }
    try {
      dependencyHandler = require(dependencyHandlerPath);
    } catch (e) {
      logger.debug(util.inspect(e));
    }
  }

  if (!dependencyHandler) {
    msg = util.format('No special dependencyHandler for dependency type: %s %s',
      dependency.operation, dependency.type);
    return next();
  }

  if (!rootDir) {
    msg = util.format('No root directory for dependency type: %s %s',
      dependency.operation, dependency.type);
    bag.isGrpSuccess = false;
    return next(true);
  }

  var params = {
    dependency: dependency,
    builderApiAdapter: bag.builderApiAdapter,
    rootDir: rootDir
  };

  dependencyHandler(params,
    function (err) {
      if (err)
        bag.isGrpSuccess = false;
      return next(err);
    }
  );
}
