'use strict';

var self = assembleDependencyScripts;
module.exports = self;

var path = require('path');
var fs = require('fs');

function assembleDependencyScripts(externalBag, callback) {
  var bag = {
    stepData: externalBag.stepData,
    stepConsoleAdapter: externalBag.stepConsoleAdapter,
    execTemplatesRootDir: externalBag.execTemplatesRootDir,
    error: false
  };
  bag.who = util.format('%s|execute|step|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _assembleDependencyScripts.bind(null, bag),
      _addDependencyScriptsToStep.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, 'Failed to assemble dependency scripts');
      else
        logger.info(bag.who, 'Successfully assembled dependency scripts');

      var result = {
        stepData: bag.stepData
      };
      return callback(err, result);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'execTemplatesRootDir',
    'stepData',
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

  bag.dependencyTemplatePath = path.join(bag.execTemplatesRootDir,
    'resources', '{{resourceType}}', '{{resourceType}}.sh');

  return next(hasErrors);
}

function _assembleDependencyScripts(bag, next) {
  var who = bag.who + '|' + _assembleDependencyScripts.name;
  logger.verbose(who, 'Inside');

  var error = false;
  bag.inDependencyScripts = [];
  bag.outDependencyScripts = [];

  bag.stepConsoleAdapter.openCmd('Assembling scripts for required resources');

  _.each(bag.stepData.resources,
    function (resource) {
      var resourceType =
        global.systemCodesByCode[resource.resourceTypeCode].name;
      var templateScript;
      _.each(resource.operations,
        function (operation) {
          var operationType = operation === 'IN' ? 'dependsOn' : 'output';
          var dependencyTemplatePath = path.join(bag.execTemplatesRootDir,
            'resources', resourceType, operationType + '.sh');
          try {
            templateScript = fs.readFileSync(dependencyTemplatePath,
              'utf8').toString();
          } catch(e) {
            logger.debug(util.inspect(e));
          }
          if (_.isEmpty(templateScript)) return;
          var err = false;
          var template = _.template(templateScript);
          try {
            if (operation === 'IN')
              bag.inDependencyScripts.push(template({ 'context': resource }));
            else
              bag.outDependencyScripts.push(template({ 'context': resource }));
          } catch(e) {
            err = true;
            error = true;
            logger.error(util.inspect(e));
          }
          if (err)
            bag.stepConsoleAdapter.publishMsg(
              util.format('Failed to create dependency script for resource: %s',
              resource.resourceName)
            );
          else
            bag.stepConsoleAdapter.publishMsg(
              util.format('Successfully created dependency script for ' +
              'resource: %s', resource.resourceName)
            );

        }
      )
    }
  );

  if (error) {
    bag.stepConsoleAdapter.closeCmd(false);
    return next(true);
  }

  return next();
}

function _addDependencyScriptsToStep(bag, next) {
  var who = bag.who + '|' + _addDependencyScriptsToStep.name;
  logger.verbose(who, 'Inside');

  var step = bag.stepData.step || {};
  step.execution = step.execution || {};
  if (!_.isEmpty(bag.inDependencyScripts))
    step.execution.dependsOn = bag.inDependencyScripts;

  if (!_.isEmpty(bag.outDependencyScripts))
    step.execution.output = bag.outDependencyScripts;

  bag.stepData.step = step;
  return next();
}
