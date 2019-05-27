'use strict';

var self = prepData;
module.exports = self;

function prepData(externalBag, callback) {
  var bag = {
    stepId: externalBag.stepId,
    pipelineId: externalBag.pipelineId,
    runId: externalBag.runId,
    builderApiAdapter: externalBag.builderApiAdapter,
    stepConsoleAdapter: externalBag.stepConsoleAdapter,
    runResourceVersions: [],
    runStepConnections: [],
    pipeline: {},
    project: {},
    integrations: []
  };
  bag.who = util.format('%s|executeStep|step|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _getRunResourceVersions.bind(null, bag),
      _getRunStepConnections.bind(null, bag),
      _getProjectIntegrations.bind(null, bag),
      _getResources.bind(null, bag),
      _getPipeline.bind(null, bag),
      _getProject.bind(null, bag),
      _getRun.bind(null, bag)
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
        project: bag.project,
        integrations: bag.integrations,
        run: bag.run
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
    'stepConsoleAdapter',
    'runId'
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

function _getProjectIntegrations(bag, next) {
  var who = bag.who + '|' + _getProjectIntegrations.name;
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
  bag.builderApiAdapter.getProjectIntegrations(query,
    function (err, integrations) {
      if (err) {
        var msg = util.format('%s, getProjectIntegrations for' +
          ' integration names %s failed with error: %s',
          bag.who, integrationNames.join(','), err);
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

function _getProject(bag, next) {
  var who = bag.who + '|' + _getProject.name;
  logger.verbose(who, 'Inside');

  bag.builderApiAdapter.getProjectById(bag.pipeline.projectId,
    function (err, project) {
      if (err) {
        var msg = util.format('%s, getProjectById for id %s ' +
          'failed with error: %s', bag.who, bag.pipeline.projectId, err);
        logger.warn(msg);
        bag.stepConsoleAdapter.openCmd('Fetching project');
        bag.stepConsoleAdapter.publishMsg(msg);
        bag.stepConsoleAdapter.closeCmd(false);
        return next(true);
      }

      bag.project = project;
      return next();
    }
  );
}

function _getRun(bag, next) {
  var who = bag.who + '|' + _getRun.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.openCmd('Fetching run');

  bag.builderApiAdapter.getRunById(bag.runId,
    function (err, run) {
      if (err) {
        var msg = util.format('%s, getRunById for id %s ' +
          'failed with error: %s', bag.who, bag.runId, err);
        logger.warn(msg);
        bag.stepConsoleAdapter.publishMsg(msg);
        bag.stepConsoleAdapter.closeCmd(false);
        return next(true);
      }

      bag.run = run;

      bag.stepConsoleAdapter.publishMsg('Successfully fetched run');
      bag.stepConsoleAdapter.closeCmd(true);
      return next();
    }
  );
}
