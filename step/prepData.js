'use strict';

var self = prepData;
module.exports = self;

function prepData(externalBag, callback) {
  var bag = {
    stepId: externalBag.stepId,
    builderApiAdapter: externalBag.builderApiAdapter
  };
  bag.who = util.format('%s|step|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _getRunResourceVersions.bind(null, bag),
      _getRunStepConnections.bind(null, bag),
      _getIntegrations.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to prep data'));
      else
        logger.info(bag.who, 'Successfully fetched and created prep data');

      var result = {
        runResourceVersions: bag.runResVersions,
        runStepConnections: bag.runStepConnections,
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
    'builderApiAdapter'
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

  var query = util.format('stepIds=%s', bag.stepId);
  bag.builderApiAdapter.getRunResourceVersions(query,
    function (err, runResVersions) {
      if (err) {
        logger.warn(util.format('%s, getRunResourceVersions for stepId %s ' +
          'failed with error: %s', bag.who, bag.stepId, err));
        return next(true);
      }

      bag.runResVersions = runResVersions;
      return next();
    }
  );
}

function _getRunStepConnections(bag, next) {
  var who = bag.who + '|' + _getRunStepConnections.name;
  logger.verbose(who, 'Inside');

  var query = util.format('stepIds=%s', bag.stepId);
  bag.builderApiAdapter.getRunStepConnections(query,
    function (err, runStepConnections) {
      if (err) {
        logger.warn(util.format('%s, getRunStepConnections for stepId %s ' +
          'failed with error: %s', bag.who, bag.stepId, err));
        return next(true);
      }

      bag.runStepConnections = runStepConnections;
      return next();
    }
  );
}

function _getIntegrations(bag, next) {
  var who = bag.who + '|' + _getIntegrations.name;
  logger.verbose(who, 'Inside');

  var integrationNames = _.union(_.pluck(
    _.pluck(bag.runResVersions, 'configPropertyBag'), 'integrationName'),
    _.pluck(bag.runStepConnections, 'operationIntegrationName')
  );

  if (_.isEmpty(integrationNames))
    return next();

  var query = util.format('names=%s', integrationNames.join(','));
  bag.builderApiAdapter.getIntegrations(query,
    function (err, integrations) {
      if (err) {
        logger.warn(util.format('%s, getIntegrations for stepId %s ' +
          'failed with error: %s', bag.who, bag.stepId, err));
        return next(true);
      }

      bag.integrations = integrations;
      return next();
    }
  );
}
