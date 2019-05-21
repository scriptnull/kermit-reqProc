'use strict';

var self = downloadArtifacts;
module.exports = self;

var download = require('./scripts/download.js');

function downloadArtifacts(externalBag, callback) {
  var bag = {
    stepData: externalBag.stepData,
    projectId: externalBag.projectId,
    stepWorkspacePath: externalBag.stepWorkspacePath,
    runWorkspacePath: externalBag.runWorkspacePath,
    pipelineWorkspacePath: externalBag.pipelineWorkspacePath,
    stepConsoleAdapter: externalBag.stepConsoleAdapter,
    builderApiAdapter: externalBag.builderApiAdapter,
    isGrpSuccess: true
  };

  bag.stepConsoleAdapter.openCmd('Downloading archive for ' +
    (bag.stepData && bag.stepData.step && bag.stepData.step.name));
  bag.who = util.format('%s|step|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _getStepArtifactUrl.bind(null, bag),
      _getRunArtifactUrl.bind(null, bag),
      _getPipelineArtifactUrl.bind(null, bag),
      _downloadArtifacts.bind(null, bag)
    ],
    function (err) {
      if (bag.isGrpSuccess)
        bag.stepConsoleAdapter.closeCmd(true);
      else
        bag.stepConsoleAdapter.closeCmd(false);

      if (err)
        logger.error(bag.who, util.format('Failed to download artifacts'));
      else
        logger.info(bag.who, 'Successfully downloaded artifacts');

      return callback(err);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'stepData',
    'stepConsoleAdapter',
    'stepWorkspacePath',
    'runWorkspacePath',
    'pipelineWorkspacePath',
    'builderApiAdapter'
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

function _getStepArtifactUrl(bag, next) {
  var who = bag.who + '|' + _getStepArtifactUrl.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.publishMsg('Getting download URL for step');

  bag.stepArtifactName = 'archive.tar.gz';

  bag.builderApiAdapter.getLatestArtifactUrlForStepName(bag.projectId,
    bag.stepData.step.name,
    function (err, artifactUrls) {
      var msg;
      if (err) {
        msg = util.format('%s, Failed to get artifact URL for ' +
          'step %s', who, bag.stepData.step.name, err);

        bag.stepConsoleAdapter.publishMsg(msg);
        return next();
      }

      bag.stepArtifactUrl = artifactUrls.get;
      bag.stepArtifactUrlOpts = artifactUrls.getOpts;
      msg = util.format(
        'Got artifact URL for step %s', bag.stepData.step.name);
      bag.stepConsoleAdapter.publishMsg(msg);
      return next();
    }
  );
}

function _getRunArtifactUrl(bag, next) {
  var who = bag.who + '|' + _getRunArtifactUrl.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.publishMsg('Getting download URL for run');

  bag.runArtifactName = util.format('%s.tar.gz', bag.stepData.step.runId);

  var query = 'artifactName=' + bag.runArtifactName;

  bag.builderApiAdapter.getRunArtifactUrls(bag.stepData.step.runId, query,
    function (err, artifactUrls) {
      var msg;
      if (err) {
        msg = util.format('%s, Failed to get artifact URLs for ' +
          'runId: %s', who, bag.stepData.step.runId, err);

        bag.stepConsoleAdapter.publishMsg(msg);
        return next();
      }

      bag.runArtifactUrl = artifactUrls.get;
      bag.runArtifactUrlOpts = artifactUrls.getOpts;

      bag.runArtifactHeadUrl = artifactUrls.head;
      bag.runArtifactHeadUrlOpts = artifactUrls.headOpts;
      msg = util.format(
        'Got artifact URL for runId: %s ', bag.stepData.step.runId);
      bag.stepConsoleAdapter.publishMsg(msg);
      return next();
    }
  );
}

function _getPipelineArtifactUrl(bag, next) {
  var who = bag.who + '|' + _getPipelineArtifactUrl.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.publishMsg('Getting download URL for pipeline');

  bag.pipelineArtifactName = util.format('%s.tar.gz',
    bag.stepData.step.pipelineId);

  var query = 'artifactName=' + bag.pipelineArtifactName;

  bag.builderApiAdapter.getPipelineArtifactUrls(bag.stepData.step.pipelineId,
    query,
    function (err, artifactUrls) {
      var msg;
      if (err) {
        msg = util.format('%s, Failed to get artifact URLs for ' +
          'pipelineId: %s', who, bag.stepData.step.pipelineId, err);

        bag.stepConsoleAdapter.publishMsg(msg);
        return next();
      }

      bag.pipelineArtifactUrl = artifactUrls.get;
      bag.pipelineArtifactUrlOpts = artifactUrls.getOpts;

      bag.pipelineArtifactHeadUrl = artifactUrls.head;
      bag.pipelineArtifactHeadUrlOpts = artifactUrls.headOpts;
      msg = util.format('Got artifact URL for pipelineId: %s ',
        bag.stepData.step.pipelineId);
      bag.stepConsoleAdapter.publishMsg(msg);
      return next();
    }
  );
}

function _downloadArtifacts(bag, next) {
  var who = bag.who + '|' + _downloadArtifacts.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.publishMsg('Downloading artifacts');

  var scriptBag = {
    stepArtifactUrl: bag.stepArtifactUrl,
    stepArtifactUrlOpts: bag.stepArtifactUrlOpts,
    stepArtifactName: bag.stepArtifactName,
    stepWorkspacePath: bag.stepWorkspacePath,
    runArtifactUrl: bag.runArtifactUrl,
    runArtifactUrlOpts: bag.runArtifactUrlOpts,
    runArtifactHeadUrl: bag.runArtifactHeadUrl,
    runArtifactHeadUrlOpts: bag.runArtifactHeadUrlOpts,
    runArtifactName: bag.runArtifactName,
    runWorkspacePath: bag.runWorkspacePath,
    pipelineArtifactUrl: bag.pipelineArtifactUrl,
    pipelineArtifactUrlOpts: bag.pipelineArtifactUrlOpts,
    pipelineArtifactHeadUrl: bag.pipelineArtifactHeadUrl,
    pipelineArtifactHeadUrlOpts: bag.pipelineArtifactHeadUrlOpts,
    pipelineArtifactName: bag.pipelineArtifactName,
    pipelineWorkspacePath: bag.pipelineWorkspacePath,
    builderApiAdapter: bag.builderApiAdapter,
    stepConsoleAdapter: bag.stepConsoleAdapter
  };

  download(scriptBag,
    function (err) {
      if (err) {
        bag.isGrpSuccess = false;
        logger.error(who,
          util.format('Failed to download artifacts with error: %s', err)
        );
        return next(true);
      }
      logger.debug('Successfully downloaded artifacts');
      return next();
    }
  );
}
