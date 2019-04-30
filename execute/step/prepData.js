'use strict';

var self = prepData;
module.exports = self;

function prepData(externalBag, callback) {
  var bag = {
    stepId: externalBag.stepId,
    pipelineId: externalBag.pipelineId,
    builderApiAdapter: externalBag.builderApiAdapter,
    stepConsoleAdapter: externalBag.stepConsoleAdapter,
    runResourceVersions: [],
    runStepConnections: [],
    pipeline: {},
    integrations: []
  };
  bag.who = util.format('%s|executeStep|step|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _getRunResourceVersions.bind(null, bag),
      _getRunStepConnections.bind(null, bag),
      _getIntegrations.bind(null, bag),
      _getResources.bind(null, bag),
      _getPipeline.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to prep data'));
      else
        logger.info(bag.who, 'Successfully fetched and created prep data');

      var result = {
        runResourceVersions: bag.runResourceVersions,
        runStepConnections: bag.runStepConnections,
        pipeline: bag.pipeline,
        integrations: bag.integrations
      };

      return callback(err, result);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'stepId',
    'builderApiAdapter',
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

function _getRunResourceVersions(bag, next) {
  var who = bag.who + '|' + _getRunResourceVersions.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.openCmd('Fetching run resource versions');

  var query = util.format('stepIds=%s', bag.stepId);
  bag.builderApiAdapter.getRunResourceVersions(query,
    function (err, runResVersions) {
      if (err) {
        var msg = util.format('%s, getRunResourceVersions for stepId %s ' +
          'failed with error: %s', bag.who, bag.stepId, err);
        logger.warn(msg);
        bag.stepConsoleAdapter.publishMsg(msg);
        bag.stepConsoleAdapter.closeCmd(false);
        return next(err);
      } else {
        bag.runResourceVersions = runResVersions;
        bag.stepConsoleAdapter.publishMsg(
          'Successfully fetched run resource versions with stepId: ' +
          bag.stepId);
        bag.stepConsoleAdapter.closeCmd(true);
      }
      return next();
    }
  );
}

function _getRunStepConnections(bag, next) {
  var who = bag.who + '|' + _getRunStepConnections.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.openCmd('Fetching run step connections');

  var query = util.format('stepIds=%s', bag.stepId);
  bag.builderApiAdapter.getRunStepConnections(query,
    function (err, runStepConnections) {
      if (err) {
        var msg = util.format('%s, getRunStepConnections for stepId %s ' +
          'failed with error: %s', bag.who, bag.stepId, err);
        logger.warn(msg);
        bag.stepConsoleAdapter.publishMsg(msg);
        bag.stepConsoleAdapter.closeCmd(false);
        return next(true);
      } else {
        bag.runStepConnections = runStepConnections;
        bag.stepConsoleAdapter.publishMsg(
          'Successfully fetched run step connections with stepId: ' +
          bag.stepId);
        bag.stepConsoleAdapter.closeCmd(true);
      }
      return next();
    }
  );
}

function _getIntegrations(bag, next) {
  var who = bag.who + '|' + _getIntegrations.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.openCmd('Fetching integrations');

  var integrationNames = _.compact(_.union(_.pluck(
    _.pluck(bag.runResourceVersions, 'resourceConfigPropertyBag'),
    'integrationName'),
    _.pluck(bag.runStepConnections, 'operationIntegrationName')
  ));

  if (_.isEmpty(integrationNames)) {
    bag.stepConsoleAdapter.publishMsg(
      'No Integrations present for step with stepId: ' + bag.stepId);
    bag.stepConsoleAdapter.closeCmd(true);
    return next();
  }

  var projectId = bag.runStepConnections[0].projectId;
  var query = util.format('names=%s&projectIds=%s',
    integrationNames.join(','), projectId);
  bag.builderApiAdapter.getIntegrations(query,
    function (err, integrations) {
      if (err) {
        var msg = util.format('%s, getIntegrations for integration names %s ' +
          'failed with error: %s', bag.who, integrationNames.join(','), err);
        logger.warn(msg);
        bag.stepConsoleAdapter.publishMsg(msg);
        bag.stepConsoleAdapter.closeCmd(false);
        return next(true);
      } else {
        bag.stepConsoleAdapter.publishMsg(
          'Successfully fetched integrations with integration names: ' +
          integrationNames.join(','));
        bag.stepConsoleAdapter.closeCmd(true);
        bag.integrations = integrations;
      }
      return next();
    }
  );
}

function _getResources(bag, next) {
  var who = bag.who + '|' + _getResources.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.openCmd('Fetching resources');

  var resourceNames =
    _.compact(_.pluck(bag.runStepConnections,
      'operationRunResourceVersionName'));

  if (_.isEmpty(resourceNames)) {
    bag.stepConsoleAdapter.publishMsg(
      'No resources present for step with stepId: ' + bag.stepId);
    bag.stepConsoleAdapter.closeCmd(true);
    return next();
  }

  var projectId = bag.runStepConnections[0].projectId;
  var query = util.format('names=%s&projectIds=%s',
    resourceNames.join(','), projectId);
  bag.builderApiAdapter.getResources(query,
    function (err, resources) {
      if (err) {
        var msg = util.format('%s, getResources for resourceNames %s ' +
          'failed with error: %s', bag.who, resourceNames.join(','), err);
        logger.warn(msg);
        bag.stepConsoleAdapter.publishMsg(msg);
        bag.stepConsoleAdapter.closeCmd(false);
        return next(true);
      } else {
        var indexResourcesByName = _.indexBy(resources, 'name');
        _.each(bag.runResourceVersions,
          function (runResourceVersion) {
            var resource =
              indexResourcesByName[runResourceVersion.resourceName];
            if (!_.isEmpty(resource)) {
              runResourceVersion.resourceId = resource.id;
              runResourceVersion.systemPropertyBag = resource.systemPropertyBag;
              runResourceVersion.staticPropertyBag = resource.staticPropertyBag;
            }
          }
        );
        bag.stepConsoleAdapter.publishMsg(
          'Successfully fetched resources with resourceNames: ' +
          resourceNames.join(','));
        bag.stepConsoleAdapter.closeCmd(true);
      }
      return next();
    }
  );
}

function _getPipeline(bag, next) {
  var who = bag.who + '|' + _getPipeline.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.openCmd('Fetching pipeline');

  bag.builderApiAdapter.getPipelineById(bag.pipelineId,
    function (err, pipeline) {
      if (err) {
        var msg = util.format('%s, getPipelineById for id %s ' +
          'failed with error: %s', bag.who, bag.pipelineId, err);
        logger.warn(msg);
        bag.stepConsoleAdapter.publishMsg(msg);
        bag.stepConsoleAdapter.closeCmd(false);
        return next(true);
      }

      bag.pipeline = pipeline;

      bag.stepConsoleAdapter.publishMsg('Successfully fetched pipeline');
      bag.stepConsoleAdapter.closeCmd(true);
      return next();
    }
  );
}
