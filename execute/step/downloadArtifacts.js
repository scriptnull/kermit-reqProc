'use strict';

var self = downloadArtifacts;
module.exports = self;

var download = require('./scripts/download.js');

function downloadArtifacts(externalBag, callback) {
  var bag = {
    stepData: externalBag.stepData,
    projectId: externalBag.projectId,
    stepWorkspacePath: externalBag.stepWorkspacePath,
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
      _getArtifactUrl.bind(null, bag),
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

  bag.step = {
    id: bag.stepData.step.id,
    projectId: bag.projectId,
    name: bag.stepData.step.name
  };

  bag.artifactName = 'archive.tar.gz';

  return next(hasErrors);
}

function _getArtifactUrl(bag, next) {
  var who = bag.who + '|' + _getArtifactUrl.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.publishMsg('Getting download URL');

  bag.builderApiAdapter.getLatestArtifactUrlForStepName(bag.step.projectId,
    bag.step.name,
    function (err, artifactUrls) {
      var msg;
      if (err) {
        msg = util.format('%s, Failed to get artifact URL for ' +
          'step %s', who, bag.step.name, err);

        bag.stepConsoleAdapter.publishMsg(msg);
        return next();
      }

      bag.artifactUrl = artifactUrls.get;
      msg = util.format(
        'Got artifact URL for stepId: %s ', bag.step.id);
      bag.stepConsoleAdapter.publishMsg(msg);
      return next();
    }
  );
}

function _downloadArtifacts(bag, next) {
  if (!bag.artifactUrl) return next();
  var who = bag.who + '|' + _downloadArtifacts.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.publishMsg('Downloading artifacts');

  var scriptBag = {
    artifactUrl: bag.artifactUrl,
    artifactName: bag.artifactName,
    stepWorkspacePath: bag.stepWorkspacePath,
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
