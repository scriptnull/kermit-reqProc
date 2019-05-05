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
    stepDir: externalBag.stepDir,
    stepData: {},
    stepEnvs: [],
    stepConsoleAdapter: externalBag.stepConsoleAdapter
  };
  bag.who = util.format('%s|step|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _prepareStepJSON.bind(null, bag)
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
    'stepDir',
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

  bag.stepEnvs.push({
    key: 'STEP_ID',
    value: bag.step.id
  });
  bag.stepEnvs.push({
    key: 'STEP_NAME',
    value: bag.step.name
  });
  bag.stepEnvs.push({
    key: 'STEP_TYPE',
    value: global.systemCodesByCode[bag.step.typeCode].name
  });

  if (!_.isEmpty(bag.step.setupPropertyBag))
    bag.stepData.step['setup'] = bag.step.setupPropertyBag;

  if (!_.isEmpty(bag.step.execPropertyBag))
    bag.stepData.step['execution'] = bag.step.execPropertyBag;

  var integrationsByName = _.indexBy(bag.integrations, 'name');
  var runResourceVersionsByResourceName = _.indexBy(
    bag.runResourceVersions, 'resourceName');

  _.each(bag.runStepConnections,
    function (runStepConnection) {
      var runResourceVersion = runResourceVersionsByResourceName[
        runStepConnection.operationRunResourceVersionName];

      var allRunStepConnections = _.filter(bag.runStepConnections,
        function (connection) {
          return connection.operationRunResourceVersionName ===
            runStepConnection.operationRunResourceVersionName;
        }
      );

      var triggers = _.pluck(allRunStepConnections, 'isTrigger');
      var isTrigger = _.contains(triggers, true);

      var integration;
      var integrationObject;
      if (runResourceVersion) {
        var resource = runResourceVersion;
        resource.operations = _.pluck(allRunStepConnections, 'operation');
        resource.isTrigger = isTrigger;
        if (_.contains(resource.operations, 'OUT'))
          resource.resourcePath = util.format('%s/output/resources/%s',
            bag.stepDir, resource.resourceName);
        else if (_.contains(resource.operations, 'IN'))
          resource.resourcePath = util.format('%s/dependencyState/resources/%s',
            bag.stepDir, resource.resourceName);
        if (integrationsByName[
          runResourceVersion.resourceConfigPropertyBag.integrationName]) {
          integration = integrationsByName[
            runResourceVersion.resourceConfigPropertyBag.integrationName];
          if (integration) {
            integrationObject = __createIntegrationObject(integration);
            resource.integration = _.extend(integrationObject.integrationValues,
              integrationObject.formJSONValues);
          }
        }

        bag.stepData.resources[runResourceVersion.resourceName] = resource;

        var operation;
        if (_.contains(resource.operations, 'OUT'))
          operation = 'OUT';
        else
          operation = resource.operations[0];

        var resPrefix = 'res_' + runResourceVersion.resourceName + '_';
        bag.stepEnvs.push({
          key: resPrefix + 'resourcePath',
          value: resource.resourcePath
        });
        bag.stepEnvs.push({
          key: resPrefix + 'operation',
          value: operation
        });
        bag.stepEnvs.push({
          key: resPrefix + 'isTrigger',
          value: resource.isTrigger
        });
        bag.stepEnvs.push({
          key: resPrefix + 'resourceId',
          value: resource.resourceId
        });
        bag.stepEnvs = bag.stepEnvs.concat(
          __convertObjToEnvs(resource.resourceVersionContentPropertyBag,
            resPrefix
          )
        );
        bag.stepEnvs = bag.stepEnvs.concat(
          __convertObjToEnvs(resource.resourceConfigPropertyBag, resPrefix)
        );
        bag.stepEnvs = bag.stepEnvs.concat(
          __convertObjToEnvs(resource.systemPropertyBag, resPrefix)
        );
        bag.stepEnvs = bag.stepEnvs.concat(
          __convertObjToEnvs(resource.staticPropertyBag, resPrefix)
        );
        bag.stepEnvs = bag.stepEnvs.concat(
          __convertObjToEnvs(resource.integration, resPrefix + 'int_')
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
          bag.stepEnvs = bag.stepEnvs.concat(
            __convertObjToEnvs(bag.stepData.integrations[integration.name],
              'int_' + integration.name + '_')
          );
        }
      }
    }
  );
  bag.stepConsoleAdapter.publishMsg('Successfully created step.json');
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

function __convertObjToEnvs(obj, envPrefix) {
  var envs = [];
  _.each(obj,
    function (val, key) {
      envs.push(
        {
          key: envPrefix + key,
          value: val
        }
      );
    }
  );

  return envs;
}
