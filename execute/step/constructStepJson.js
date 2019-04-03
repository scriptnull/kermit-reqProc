'use strict';

var self = constructStepJson;
module.exports = self;

var getValuesFromIntegrationJson =
  require('../../_common/helpers/getValuesFromIntegrationJson.js');

function constructStepJson(externalBag, callback) {
  var bag = {
    runResourceVersions: externalBag.runResourceVersions,
    runStepConnections: externalBag.runStepConnections,
    integrations: externalBag.integrations,
    step: externalBag.step,
    stepData: {}
  };
  bag.who = util.format('%s|step|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _prepareStepJSON.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to setup dirs'));
      else
        logger.info(bag.who, util.format('Successfully setup dirs'));

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
    'step',
    'runResourceVersions',
    'runStepConnections',
    'integrations'
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

function _prepareStepJSON(bag, next) {
  var who = bag.who + '|' + _prepareStepJSON.name;
  logger.verbose(who, 'Inside');

  bag.stepData = {
    step: {
      id: bag.step.id,
      name: bag.step.name,
      type: global.systemCodesByCode[bag.step.typeCode].name
    },
    resources: {},
    integrations: {}
  };

  if (!_.isEmpty(bag.step.setupPropertyBag))
    bag.stepData.step['setup'] = bag.step.setupPropertyBag;

  if (!_.isEmpty(bag.step.execPropertyBag))
    bag.stepData.step['execute'] = bag.step.execPropertyBag;

  var integrationsByName = _.indexBy(bag.integrations, 'name');
  var runResourceVersionsByResourceName = _.indexBy(
    bag.runResourceVersions, 'resourceName');

  _.each(bag.runStepConnections,
    function(runStepConnection) {
      var runResourceVersion = runResourceVersionsByResourceName[
        runStepConnection.operationRunResourceName];

      var integration;
      var integrationObject;
      if (runResourceVersion) {
        var resource = {
          id: runStepConnection.operationRunResourceId,
          name: runStepConnection.operationRunResourceName,
          operation: runStepConnection.operation,
          typeCode: runResourceVersion.resourceTypeCode,
          isPassive: runStepConnection.isPassive,
          version: {
            id: runResourceVersion.resourceVersionId,
            propertyBag: runResourceVersion.resourceVersionContentPropertyBag
          },
          systemPropertyBag: runResourceVersion.systemPropertyBag,
          configPropertyBag: runResourceVersion.resourceConfigPropertyBag
        };

        if (integrationsByName[
          runResourceVersion.resourceConfigPropertyBag.integrationName]) {
          integration = integrationsByName[
            runResourceVersion.resourceConfigPropertyBag.integrationName];
          if (integration) {
            integrationObject = __createIntegrationObject(integration);
            resource.integration = _.extend(integrationObject.integrationValues,
              integrationObject.formJSONValues);
          }
          bag.stepData.resources[
            runStepConnection.operationRunResourceName] = resource;
        }
      }

      if (integrationsByName[
        runStepConnection.operationIntegrationName]) {
        integration = integrationsByName[
          runStepConnection.operationIntegrationName];
        if (integration) {
          integrationObject = __createIntegrationObject(integration);
          bag.stepData.integrations[integration.name] =
            _.extend(integrationObject.integrationValues,
              integrationObject.formJSONValues);
        }
      }
    }
  );
  return next();
}

function __createIntegrationObject(integration) {
  var integrationObject = {};
  integrationObject.integrationValues = {
    id: integration.id,
    name: integration.name
  };
  integrationObject.formJSONValues =
    getValuesFromIntegrationJson(integration.formJSONValues);

  return integrationObject;
}
