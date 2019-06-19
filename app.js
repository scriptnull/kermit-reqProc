'use strict';

var ReqProcMS = require('./_common/micro/MicroService.js');
var setupMS = require('./_common/micro/setupMS.js');
var microWorker = require('./microWorker.js');

var isDirectory = require('./_common/helpers/isDirectory.js');

var msParams = {
  microWorker: microWorker
};

var params = {
  msName: 'reqProc'
};

var consoleErrors = [];
setupMS(params);

var who = util.format('msName:%s', msName);
logger.info(util.format('Checking system config for %s', who));

if (!global.config.amqpUrl)
  consoleErrors.push(util.format('%s is missing: amqpUrl', who));

if (!global.config.amqpExchange)
  consoleErrors.push(util.format('%s is missing: amqpExchange', who));

if (!global.config.inputQueue)
  consoleErrors.push(util.format('%s is missing: inputQueue', who));

if (!global.config.apiUrl)
  consoleErrors.push(util.format('%s is missing: apiUrl', who));

if (!global.config.baseDir)
  consoleErrors.push(util.format('%s is missing: baseDir', who));

if (!global.config.reqProcDir)
  consoleErrors.push(util.format('%s is missing: reqProcDir', who));

if (!global.config.reqExecDir)
  consoleErrors.push(util.format('%s is missing: reqExecDir', who));

if (!global.config.reqKickDir)
  consoleErrors.push(util.format('%s is missing: reqKickDir', who));

if (!global.config.reqProcContainerName)
  consoleErrors.push(util.format('%s is missing: reqProcContainerName', who));

if (!global.config.execTemplatesRootDir)
  consoleErrors.push(util.format('%s is missing: execTemplatesRootDir', who));

if (!global.config.defaultTaskContainerOptions)
  consoleErrors.push(
    util.format('%s is missing: defaultTaskContainerOptions', who)
  );

if (!global.config.reqExecCommand)
  consoleErrors.push(util.format('%s is missing: reqExecCommand', who));

if (!global.config.shippableNodeArchitecture)
  consoleErrors.push(
    util.format('%s is missing: shippableNodeArchitecture', who)
  );

if (!global.config.shippableNodeOperatingSystem)
  consoleErrors.push(
    util.format('%s is missing: shippableNodeOperatingSystem', who)
  );

if (!global.config.shippableReleaseVersion)
  consoleErrors.push(
    util.format('%s is missing: shippableReleaseVersion', who)
  );

if (!global.config.shippableRuntimeVersion)
  consoleErrors.push(
    util.format('%s is missing: shippableRuntimeVersion', who)
  );

if (!global.config.clusterTypeCode)
  consoleErrors.push(
    util.format('%s is missing: clusterTypeCode', who)
  );

if (!isDirectory(global.config.baseDir))
  consoleErrors.push(util.format('%s is missing directory: %s', who,
    global.config.baseDir));

if (!isDirectory(global.config.reqProcDir))
  consoleErrors.push(util.format('%s is missing directory: %s', who,
    global.config.reqProcDir));

if (!isDirectory(global.config.reqExecDir))
  consoleErrors.push(util.format('%s is missing directory: %s', who,
    global.config.reqExecDir));

if (!isDirectory(global.config.reqKickDir))
  consoleErrors.push(util.format('%s is missing directory: %s', who,
    global.config.reqKickDir));

if (consoleErrors.length > 0) {
  _.each(consoleErrors,
    function (err) {
      logger.error(who, err);
    }
  );
  return process.exit(1);
}

logger.info(util.format('system config checks for %s succeeded', who));
var service = new ReqProcMS(msParams);
// This is where micro service starts
service.init();
