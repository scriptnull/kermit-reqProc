'use strict';

var self = setupDependencies;
module.exports = self;

function setupDependencies(externalBag, callback) {
  var bag = {
    runResourceVersions: externalBag.runResourceVersions,
    runStepConnections: externalBag.runStepConnections,
    integrations: externalBag.integrations,
    stepJSONData: {}
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
        stepJSONData: bag.stepJSONData
      };

      return callback(err, result);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
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

  bag.stepJSONData = {
    step: {},
    resources: [],
    integrations: []
  };

  bag.integrationsByName = _.indexBy(bag.integrations, 'name');

  _.each(bag.runStepConnections,
    function(runStepConnection) {
      var runResourceVersion = _.findWhere(bag.runResourceVersions,
        {resourceName: runStepConnection.operationRunResourceName});

      var integration;
      var integrationValues;
      var formJSONValues;
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
          }
        };

        if (bag.integrationsByName[
          runResourceVersion.resourceConfigPropertyBag.integrationName]) {
          integration = bag.integrationsByName[
          runResourceVersion.resourceConfigPropertyBag.integrationName];
          integrationValues = {
            id: integration.id,
            name: integration.name
          };
          formJSONValues = __flattenFormJSONValues(integration.formJSONValues);
          resource.integration = _.extend(integrationValues, formJSONValues);
          bag.stepJSONData.resources[
            runStepConnection.operationRunResourceName] = resource;
        } 
      }
    
    if (bag.integrationsByName[
      runStepConnection.operationIntegrationName]) {
      integration = bag.integrationsByName[
        runStepConnection.operationIntegrationName];
      integrationValues = {
        id: integration.id,
        name: integration.name
      };
      formJSONValues = __flattenFormJSONValues(integration.formJSONValues);
      bag.stepJSONData.integrations[integrationValues.name] =
        _.extend(integrationValues, formJSONValues);
    }
    }
  );
  return next();
}

function __flattenFormJSONValues(formJSONValues) {
  var allData = {};
  _.each(formJSONValues,
    function(formJSONValue) {
      allData[formJSONValue.label] = formJSONValue.value;
    }
  );

  return allData;
}
