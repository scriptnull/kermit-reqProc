'use strict';

var self = Adapter;
module.exports = self;

var uuid = require('node-uuid');
var ShippableAdapter = require('../Adapter.js');

function Adapter(apiToken, stepId, jobConsoleBatchSize,
  jobConsoleBufferTimeInterval) {
  this.who = util.format('%s|_common|stepConsoleAdapter|stepId:%s',
    msName, stepId);
  this.stepId = stepId;

  this.startTimeInMicroSec = new Date().getTime() * 1000;
  var processStartTime = process.hrtime();
  this.processStartTimeInMicroSec =
    processStartTime[0] * 1e6 + processStartTime[1] / 1e3;
  this.ShippableAdapter = new ShippableAdapter(apiToken);
  this.batchSize = jobConsoleBatchSize || 20;
  this.buffer = [];
  this.bufferTimeInterval = jobConsoleBufferTimeInterval || 3000;
  this.bufferTimer = null;
  this.pendingApiCalls = 0;
}

Adapter.prototype.openGrp = function (consoleGrpName) {
  var that = this;
  var who = that.who + '|_openGrp';

  that.consoleGrpName = consoleGrpName;
  that.consoleGrpId = uuid.v4();

  if (_.isEmpty(consoleGrpName))
    throw new ActErr(who, ActErr.ParamNotFound,
      'Missing param :consoleGrpName');

  var consoleGrp = {
    stepId: that.stepId,
    consoleId: that.consoleGrpId,
    parentConsoleId: 'root',
    type: 'grp',
    message: that.consoleGrpName,
    timestamp: that._getTimestamp(),
    isShown: true
  };

  that.buffer.push(consoleGrp);
  that._postToStepConsole(true);
};

Adapter.prototype.closeGrp = function (isSuccess) {
  var that = this;

  //The grp is already closed
  if (!that.consoleGrpName)
    return;

  if (!_.isBoolean(isSuccess)) isSuccess = true;

  that.closeCmd();

  var consoleGrp = {
    stepId: that.stepId,
    consoleId: that.consoleGrpId,
    parentConsoleId: 'root',
    type: 'grp',
    message: that.consoleGrpName,
    timestamp: that._getTimestamp(),
    timestampEndedAt: that._getTimestamp(),
    isSuccess: isSuccess,
    isShown: true
  };

  that.buffer.push(consoleGrp);
  that._postToStepConsole(true);
  that.consoleGrpName = null;
  that.consoleGrpId = null;
};

Adapter.prototype.openCmd = function (consoleCmdName) {
  var that = this;
  var who = that.who + '|_openCmd';

  if (_.isEmpty(consoleCmdName))
    throw new ActErr(who, ActErr.ParamNotFound,
      'Missing param :consoleCmdName');

  that.consoleCmdName = consoleCmdName;
  that.consoleCmdId = uuid.v4();

  var consoleGrp = {
    stepId: that.stepId,
    consoleId: that.consoleCmdId,
    parentConsoleId: that.consoleGrpId,
    type: 'cmd',
    message: that.consoleCmdName,
    timestamp: that._getTimestamp(),
    isShown: true
  };

  that.buffer.push(consoleGrp);
  that._postToStepConsole(true);
};

Adapter.prototype.closeCmd = function (isSuccess) {
  var that = this;

  //The cmd is already closed
  if (!that.consoleCmdName)
    return;

  if (!_.isBoolean(isSuccess)) isSuccess = true;

  var consoleGrp = {
    stepId: that.stepId,
    consoleId: that.consoleCmdId,
    parentConsoleId: that.consoleGrpId,
    type: 'cmd',
    message: that.consoleCmdName,
    timestamp: that._getTimestamp(),
    timestampEndedAt: that._getTimestamp(),
    isSuccess: isSuccess,
    isShown: false
  };

  that.buffer.push(consoleGrp);
  that._postToStepConsole(true);
  that.consoleCmdName = null;
  that.consoleCmdId = null;
};

Adapter.prototype.publishMsg = function (message) {
  var that = this;

  var consoleGrp = {
    stepId: that.stepId,
    consoleId: uuid.v4(),
    parentConsoleId: that.consoleCmdId,
    type: 'msg',
    message: message,
    timestamp: that._getTimestamp(),
    isShown: true
  };

  that.buffer.push(consoleGrp);
  that._postToStepConsole(false);
};

Adapter.prototype._postToStepConsole = function (forced) {
  var that = this;
  var who = that.who + '|_postToStepConsole';

  if (that.buffer.length > that.batchSize || forced) {
    if (that.bufferTimer) {
      // If a timeout has been set for the buffer, clear it.
      clearTimeout(that.bufferTimer);
      that.bufferTimer = null;
    }

    var consoles = that.buffer.splice(0, that.buffer.length);

    if (consoles.length === 0)
      return;

    var body = {
      stepId: that.stepId,
      stepConsoles: consoles
    };

    that.pendingApiCalls ++;
    that.ShippableAdapter.postStepConsoles(body,
      function (err) {
        that.pendingApiCalls --;
        if (err)
          logger.error(who, 'postStepConsoles Failed', err);
        logger.debug(who, 'Succeeded');
      }
    );
  } else if (!that.bufferTimer) {
    // Set a timeout that will clear the buffer in three seconds if nothing has.
    that.bufferTimer = setTimeout(
      function () {
        this._postToStepConsole(true);
      }.bind(that),
      that.bufferTimeInterval);
  }
};

Adapter.prototype.getPendingApiCallCount = function() {
  var that = this;
  return that.pendingApiCalls;
};

Adapter.prototype._getTimestamp = function () {
  var that = this;
  var currentProcessTime = process.hrtime();

  return Math.round(that.startTimeInMicroSec +
    (currentProcessTime[0] * 1e6 + currentProcessTime[1]/1e3) -
      that.processStartTimeInMicroSec);
};
