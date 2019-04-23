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
    runStatusDir: externalBag.runStatusDir,
    stepletId: externalBag.stepletId,
    builderApiToken: externalBag.builderApiToken,
    stepConsoleAdapter: externalBag.stepConsoleAdapter,
    stepletDir: externalBag.stepletDir,
    dependencyStateDir: externalBag.dependencyStateDir,
    outputDir: externalBag.outputDir,
    stepJsonPath: externalBag.stepJsonPath
  };
  bag.who = util.format('%s|step|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _setScriptEnvs.bind(null, bag),
      _escapeEnvironmentVariables.bind(null, bag),
      _assembleScript.bind(null, bag),
      _writeScript.bind(null, bag),
      _setJobEnvs.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to create stepletScript.sh'));
      else
        logger.info(bag.who, 'Successfully created stepletScript.sh');

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
    'builderApiToken',
    'runStatusDir',
    'stepletDir',
    'stepConsoleAdapter',
    'dependencyStateDir',
    'outputDir'
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

function _setScriptEnvs(bag, next) {
  var who = bag.who + '|' + _setScriptEnvs.name;
  logger.verbose(who, 'Inside');

  var scriptEnvs = bag.stepEnvs || [];

  _.each({
      'PIPLELINES_RUN_STATUS_DIR': bag.runStatusDir,
      'STEP_JSON_PATH': bag.stepJsonPath,
      'STEPLET_SCRIPT_PATH': bag.stepletScriptPath,
      'REQEXEC_BIN_PATH': global.config.baseDir + global.config.reqExecCommand,
      'STEP_DEPENDENCY_STATE_DIR': bag.dependencyStateDir,
      'STEP_OUTPUT_DIR': bag.outputDir,
      'OPERATING_SYSTEM': global.config.shippableNodeOperatingSystem,
      'ARCHITECTURE': global.config.shippableNodeArchitecture,
      'REQEXEC_DIR': global.config.reqExecDir
    }, function (value, key) {
      scriptEnvs.push({
        'key': key,
        'value': value
      });
    }
  );

  if (_.isEmpty(bag.stepData.step.setup))
    bag.stepData.step.setup = {};

  bag.stepData.step.setup.environmentVariables =
    scriptEnvs.concat(bag.stepData.step.setup.environmentVariables || []);

  return next();
}

function _escapeEnvironmentVariables(bag, next) {
  var who = bag.who + '|' + _escapeEnvironmentVariables.name;
  logger.verbose(who, 'Inside');

  _.each(bag.stepData.step.setup.environmentVariables,
    function(environmentVariableObj, index) {
      bag.stepData.step.setup.environmentVariables[index].value =
        __escapeString(
          bag.stepData.step.setup.environmentVariables[index].value
        );
    }
  );

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
  jobEnvs.push(util.format('RUN_MODE=%s', global.config.runMode));
  jobEnvs.push(util.format('SCRIPT_PATH=%s', bag.executeScriptPath));
  jobEnvs.push(util.format('STEPLET_DIR=%s', bag.stepletDir));

  if (global.config.shippableNodeOperatingSystem === 'WindowsServer_2016')
    jobEnvs.push('REQEXEC_SHELL=powershell.exe');

  var envPath = path.join(bag.runStatusDir, 'step.env');
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

  var charsToBeEscaped = ['\\\\', '\\\$', '\\\`', '\\\"'];
  _.each(charsToBeEscaped,
      function (char) {
        var regex = new RegExp(char, 'g');
        string = string.replace(regex, char);
      }
    );
  return string;
}
