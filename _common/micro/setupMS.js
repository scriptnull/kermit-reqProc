'use strict';
var self = setupMS;
module.exports = self;

global.util = require('util');
global._ = require('underscore');
global.async = require('async');

function setupMS(params) {
  global.msName = params.msName;
  process.title = params.msName;
  global.config = {};

  global.logger = require('../logging/logger.js')();
  require('../handleErrors/ActErr.js');

  /* Env Set */
  global.config.amqpExchange = 'shippableEx';
  global.config.apiUrl = process.env.SHIPPABLE_API_URL;
  global.config.wwwUrl = process.env.SHIPPABLE_WWW_URL;
  global.config.inputQueue = process.env.LISTEN_QUEUE;
  global.config.amqpUrl = process.env.SHIPPABLE_AMQP_URL;
  global.config.nodeId = process.env.NODE_ID;
  global.config.apiToken = process.env.SHIPPABLE_API_TOKEN;
  global.config.execImage = process.env.EXEC_IMAGE;
  global.config.baseDir = process.env.BASE_DIR;
  global.config.reqProcDir = process.env.REQPROC_DIR;
  global.config.reqExecDir = process.env.REQEXEC_DIR;
  global.config.reqKickDir = process.env.REQKICK_DIR;
  global.config.reqProcContainerName = process.env.REQPROC_CONTAINER_NAME;
  global.config.defaultTaskContainerOptions =
    process.env.DEFAULT_TASK_CONTAINER_OPTIONS;
  global.config.reqExecCommand = process.env.TASK_CONTAINER_COMMAND;
  global.config.shippableNodeArchitecture =
    process.env.SHIPPABLE_NODE_ARCHITECTURE;
  global.config.shippableNodeOperatingSystem =
    process.env.SHIPPABLE_NODE_OPERATING_SYSTEM;
  global.config.execTemplatesRootDir = process.env.IMAGE_EXEC_TEMPLATES_DIR;

  if (global.config.shippableNodeOperatingSystem === 'WindowsServer_2019') {
    global.config.scriptExtension = 'ps1';
    global.config.defaultShell = 'powershell';
    global.config.defaultShellArgs = [];
  } else {
    global.config.scriptExtension = 'sh';
    global.config.defaultShell = '/bin/bash';
    global.config.defaultShellArgs = ['-c'];
  }

  global.config.shippableReleaseVersion = process.env.SHIPPABLE_RELEASE_VERSION;
  global.config.shippableRuntimeVersion = process.env.SHIPPABLE_RUNTIME_VERSION;

  global.config.clusterTypeCode = process.env.CLUSTER_TYPE_CODE;
  global.config.isProcessingStep = false;
  // 15 seconds
  global.config.stepStatusPollIntervalMS = 15 * 1000;
}
