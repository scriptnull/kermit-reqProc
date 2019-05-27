'use strict';

var self = StepStatusPoller;
module.exports = self;

var fs = require('fs-extra');

function StepStatusPoller(builderApiAdapter, statusPath) {
  this.who = util.format('%s|_common|helpers|%s', msName, self.name);

  logger.verbose(util.format('Initializing %s', self.name));
  this.builderApiAdapter = builderApiAdapter;
  this.statusPath = statusPath;
  this.poller = null;
  this.stepIds = [];
  this.stepStatusPollIntervalMS = global.config.stepStatusPollIntervalMS;
}

StepStatusPoller.prototype.addStep = function (stepId) {
  var that = this;
  var who = that.who + '|addStep';
  if (that.poller) {
    logger.debug(who, 'Clearing existing poller');
    clearInterval(that.poller);
  }

  that.stepIds.push(stepId);
  logger.debug(who, 'Starting poller for stepIds: ', that.stepIds.join(','));
  that.poller = that._setStepStatusPoller();
};

StepStatusPoller.prototype.removeStep = function (stepId) {
  var that = this;
  var who = that.who + '|removeStep';
  if (that.poller) {
    logger.debug(who, 'Clearing existing poller');
    clearInterval(that.poller);
  }

  that.stepIds = _.without(that.stepIds, stepId);
  if (!_.isEmpty(that.stepIds)) {
    logger.debug(who, 'Starting poller for stepIds: ', that.stepIds.join(','));
    that.poller = that._setStepStatusPoller();
  } else {
    logger.debug(who, 'Poller not started as stepIds are empty');
  }
};

StepStatusPoller.prototype._setStepStatusPoller = function () {
  var that = this;
  return setInterval(
    function () {
      var query = util.format('stepIds=%s', that.stepIds.join(','));
      that.builderApiAdapter.getSteps(query,
        function (err, steps) {
          if (err) {
            logger.warn(util.format('getSteps for query %s, returned error %s',
              query, err));
            return;
          }

          steps = _.filter(steps,
            function (step) {
              return _.contains(that.stepIds, step.id);
            }
          );

          _.each(steps,
            function (step) {
              var statusName = global.systemCodesByCode[step.statusCode].name;
              if (statusName === 'cancelling' || statusName === 'timingOut') {
                try {
                  fs.writeFileSync(that.statusPath,
                    util.format('%s\n', statusName));
                } catch (e) {
                  logger.warn(
                    'Failed to write status to status path with error: ', e
                  );
                }

                that.removeStep(step.id);
              }
            }
          );
        }
      );
    }, that.stepStatusPollIntervalMS
  );
};
