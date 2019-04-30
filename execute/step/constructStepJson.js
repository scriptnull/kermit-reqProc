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
    stepData: {},
    stepEnvs: [],
    rawEnvs: {},
    stepConsoleAdapter: externalBag.stepConsoleAdapter
  };
  bag.who = util.format('%s|step|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _prepareStepJSON.bind(null, bag),
      _validateStepEnvs.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to create step.json'));
      else
        logger.info(bag.who, util.format('Successfully created step.json'));

      var result = {
        stepData: bag.stepData,
        stepEnvs: bag.stepEnvs
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
    'integrations',
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

function _prepareStepJSON(bag, next) {
  var who = bag.who + '|' + _prepareStepJSON.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.openCmd('Creating step.json');

  bag.stepData = {
    step: {
      id: bag.step.id,
      name: bag.step.name,
      runId: bag.step.runId,
      type: global.systemCodesByCode[bag.step.typeCode].name
    },
    resources: {},
    integrations: {}
  };
  bag.rawEnvs['STEP_ID'] = bag.step.id;
  bag.rawEnvs['STEP_NAME'] = bag.step.name;
  bag.rawEnvs['STEP_TYPE'] = global.systemCodesByCode[bag.step.typeCode].name;

  if (!_.isEmpty(bag.step.setupPropertyBag))
    bag.stepData.step['setup'] = bag.step.setupPropertyBag;

  if (!_.isEmpty(bag.step.execPropertyBag))
    bag.stepData.step['execution'] = bag.step.execPropertyBag;

  var integrationsByName = _.indexBy(bag.integrations, 'name');
  var runResourceVersionsByResourceName = _.indexBy(
    bag.runResourceVersions, 'resourceName');

  _.each(bag.runStepConnections,
    function(runStepConnection) {
      var runResourceVersion = runResourceVersionsByResourceName[
        runStepConnection.operationRunResourceVersionName];

      var integration;
      var integrationObject;
      if (runResourceVersion) {
        var resource = runResourceVersion;
        resource.operation = runStepConnection.operation;
        resource.isTrigger = runStepConnection.isTrigger;
        if (resource.operation === 'OUT')
          resource.resourcePath = util.format('%s/%s/output/resources/%s',
            global.config.runDir, bag.step.name, resource.resourceName);
        else if (resource.operation === 'IN')
          resource.resourcePath = util.format(
            '%s/%s/dependencyState/resources/%s',
            global.config.runDir, bag.step.name, resource.resourceName);
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
            runResourceVersion.resourceName] = resource;
        }

        var resPrefix = 'res_' + runResourceVersion.resourceName + '_';
        bag.rawEnvs[resPrefix + 'resourcePath'] = resource.resourcePath;
        bag.rawEnvs[resPrefix + 'operation'] = resource.operation;
        bag.rawEnvs[resPrefix + 'isTrigger'] = resource.isTrigger;
        _.each(resource.resourceVersionContentPropertyBag,
          function (value, key) {
            bag.rawEnvs[resPrefix + key] = value;
          }
        );
        _.each(resource.systemPropertyBag,
          function (value, key) {
            bag.rawEnvs[resPrefix + key] = value;
          }
        );
        _.each(resource.staticPropertyBag,
          function (value, key) {
            bag.rawEnvs[resPrefix + key] = value;
          }
        );
        var resIntPrefix = resPrefix + 'int_';
        _.each(resource.integration,
          function (value, key) {
            bag.rawEnvs[resIntPrefix + key] = value;
          }
        );
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
          var intPrefix = 'int_' + integration.name + '_';
          _.each(bag.stepData.integrations[integration.name],
            function (value, key) {
              bag.rawEnvs[intPrefix + key] = value;
            }
          );
        }
      }
    }
  );
  bag.stepConsoleAdapter.publishMsg('Successfully created step.json');
  bag.stepConsoleAdapter.closeCmd(true);
  return next();
}

function _validateStepEnvs(bag, next) {
  var who = bag.who + '|' + _validateStepEnvs.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.openCmd('Validating ENV list');
  _.each(bag.rawEnvs,
    function (value, key) {
      bag.stepEnvs.push({
        key: key,
        value: value
      });
    }
  );

  bag.stepConsoleAdapter.publishMsg('Finished validating ENV list');
  bag.stepConsoleAdapter.closeCmd(true);

  return next();
}

function __createIntegrationObject(integration) {
  var integrationObject = {};
  integrationObject.integrationValues = {
    id: integration.id,
    name: integration.name,
    masterName: integration.masterIntegrationName
  };
  integrationObject.formJSONValues =
    getValuesFromIntegrationJson(integration.formJSONValues);

  return integrationObject;
}
