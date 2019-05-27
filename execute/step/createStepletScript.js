'use strict';

var self = createStepletScript;
module.exports = self;

var fs = require('fs-extra');
var path = require('path');

var assemble = require('../../assembler/assemble.js');

function createStepletScript(externalBag, callback) {
  var bag = {
    stepData: externalBag.stepData,
    stepEnvs: externalBag.stepEnvs,
    execTemplatesRootDir: externalBag.execTemplatesRootDir,
    stepletScriptPath: externalBag.stepletScriptPath,
    statusDir: externalBag.statusDir,
    stepletId: externalBag.stepletId,
    pipelineId: externalBag.pipelineId,
    builderApiToken: externalBag.builderApiToken,
    stepConsoleAdapter: externalBag.stepConsoleAdapter,
    stepletDir: externalBag.stepletDir,
    runDir: externalBag.runDir,
    dependencyStateDir: externalBag.dependencyStateDir,
    outputDir: externalBag.outputDir,
    stepWorkspacePath: externalBag.stepWorkspacePath,
    pipelineWorkspacePath: externalBag.pipelineWorkspacePath,
    stepJsonPath: externalBag.stepJsonPath,
    stepId: externalBag.stepId
  };
  bag.who = util.format('%s|step|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _setScriptEnvs.bind(null, bag),
      _concatStepEnvsToSetup.bind(null, bag),
      _assembleScript.bind(null, bag),
      _writeScript.bind(null, bag),
      _setJobEnvs.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to create stepletScript.' +
          global.config.scriptExtension));
      else
        logger.info(bag.who, 'Successfully created stepletScript.' +
          global.config.scriptExtension);

      return callback(err);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'stepData',
    'stepEnvs',
    'execTemplatesRootDir',
    'stepletScriptPath',
    'stepletId',
    'pipelineId',
    'builderApiToken',
    'statusDir',
    'runDir',
    'stepletDir',
    'stepConsoleAdapter',
    'dependencyStateDir',
    'outputDir',
    'stepId'
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

  bag.stepDockerContainerName = util.format('step-%s-%s', bag.stepId,
    bag.stepletId);
  return next(hasErrors);
}

function _setScriptEnvs(bag, next) {
  var who = bag.who + '|' + _setScriptEnvs.name;
  logger.verbose(who, 'Inside');

  bag.stepEnvs = bag.stepEnvs || [];

  _.each({
      'STATUS_DIR': bag.statusDir,
      'STEPLET_ID': bag.stepletId,
      'STEP_JSON_PATH': bag.stepJsonPath,
      'STEPLET_SCRIPT_PATH': bag.stepletScriptPath,
      'REQEXEC_BIN_PATH': global.config.baseDir + global.config.reqExecCommand,
      'RUN_DIR': bag.runDir,
      'STEP_DEPENDENCY_STATE_DIR': bag.dependencyStateDir,
      'STEP_OUTPUT_DIR': bag.outputDir,
      'STEP_WORKSPACE_DIR': bag.stepWorkspacePath,
      'PIPELINE_WORKSPACE_DIR': bag.pipelineWorkspacePath,
      'STEP_TMP_DIR': path.join(bag.stepWorkspacePath, 'tmp'),
      'OPERATING_SYSTEM': global.config.shippableNodeOperatingSystem,
      'ARCHITECTURE': global.config.shippableNodeArchitecture,
      'REQEXEC_DIR': global.config.reqExecDir,
      'SHIPPABLE_API_URL': global.config.apiUrl,
      'BUILDER_API_TOKEN': bag.builderApiToken,
      'NO_VERIFY_SSL': !_.isUndefined(process.env.NODE_TLS_REJECT_UNAUTHORIZED),
      'STEP_DOCKER_CONTAINER_NAME': bag.stepDockerContainerName
    }, function (value, key) {
      bag.stepEnvs.push({
        'key': key,
        'value': value
      });
    }
  );

  _.each(bag.stepEnvs,
    function(stepEnvObj, index) {
      if (global.config.defaultShell === 'powershell') {
        bag.stepEnvs[index].value = util.format('%s',
          __escapeString(bag.stepEnvs[index].value)
        );
      } else {
        bag.stepEnvs[index].value = util.format('\'%s\'',
          __escapeString(bag.stepEnvs[index].value)
        );
      }
    }
  );
  return next();
}

function _concatStepEnvsToSetup(bag, next) {
  var who = bag.who + '|' + _concatStepEnvsToSetup.name;
  logger.verbose(who, 'Inside');

  if (_.isEmpty(bag.stepData.step.setup))
    bag.stepData.step.setup = {};

  bag.stepData.step.setup.environmentVariables =
    bag.stepEnvs.concat(bag.stepData.step.setup.environmentVariables || []);

  return next();
}

function _assembleScript(bag, next) {
  var who = bag.who + '|' + _assembleScript.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.openCmd('Assembling steplet script');
  var innerBag = {
    execTemplatesRootDir: bag.execTemplatesRootDir,
    json: bag.stepData.step,
    objectType: 'steps',
    objectSubType: bag.stepData.step.type
  };

  assemble(innerBag,
    function (err, result) {
      if (err) {
        bag.stepConsoleAdapter.publishMsg('Failed to assemble steplet script');
        bag.stepConsoleAdapter.closeCmd(false);
        return next(err);
      }

      bag.stepConsoleAdapter.publishMsg(
        'Successfully assembled steplet script');
      bag.stepConsoleAdapter.closeCmd(true);
      bag.assembledScript = result.assembledScript;
      return next();
    }
  );
}

function _writeScript(bag, next) {
  var who = bag.who + '|' + _writeScript.name;
  logger.debug(who, 'Inside');

  bag.stepConsoleAdapter.openCmd('Writing steplet script');
  fs.writeFile(bag.stepletScriptPath, bag.assembledScript,
    function (err) {
      if (err) {
        bag.stepConsoleAdapter.publishMsg(
          'Failed to write steplet script at: ' + bag.stepletScriptPath);
        bag.stepConsoleAdapter.closeCmd(false);
        return next(err);
      }

      fs.chmodSync(bag.stepletScriptPath, '755');
      bag.stepConsoleAdapter.publishMsg(
        'Successfully saved steplet script at: ' + bag.stepletScriptPath);
      bag.stepConsoleAdapter.closeCmd(true);
      bag.executeScriptPath = bag.stepletScriptPath;
      return next();
    }
  );
}

function _setJobEnvs(bag, next) {
  var who = bag.who + '|' + _setJobEnvs.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.openCmd('Setting step envs');
  // TODO: use templates to set these values
  var jobEnvs = [];
  jobEnvs.push(util.format('SHIPPABLE_API_URL=%s', global.config.apiUrl));
  jobEnvs.push(util.format('BUILDER_API_TOKEN=%s', bag.builderApiToken));
  jobEnvs.push(util.format('STEPLET_ID=%s', bag.stepletId));
  jobEnvs.push(util.format('PIPELINE_ID=%s', bag.pipelineId));
  jobEnvs.push(util.format('RUN_MODE=%s', global.config.runMode));
  jobEnvs.push(util.format('SCRIPT_PATH=%s', bag.executeScriptPath));
  jobEnvs.push(util.format('STEPLET_DIR=%s', bag.stepletDir));
  jobEnvs.push(util.format('STEP_DOCKER_CONTAINER_NAME=%s',
    bag.stepDockerContainerName));

  if (global.config.shippableNodeOperatingSystem === 'WindowsServer_2019')
    jobEnvs.push('REQEXEC_SHELL=powershell.exe');

  var envPath = path.join(bag.statusDir, 'step.env');
  fs.writeFile(envPath, jobEnvs.join('\n'),
    function (err) {
      if (err) {
        bag.stepConsoleAdapter.publishMsg(
          'Failed to save step envs at: ' + envPath);
        bag.stepConsoleAdapter.closeCmd(false);
        return next(err);
      }
      bag.stepConsoleAdapter.publishMsg(
        'Updated step envs at: ' + envPath);
      bag.stepConsoleAdapter.closeCmd(true);
      return next();
    }
  );
}

function __escapeString(string) {
  if (!_.isString(string)) return string;
  return string.replace(/'/g, '\'"\'"\'');
}
