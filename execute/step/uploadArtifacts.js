'use strict';

var self = uploadArtifacts;
module.exports = self;

var path = require('path');
var upload = require('./scripts/upload.js');

function uploadArtifacts(externalBag, callback) {
  var bag = {
    stepData: externalBag.stepData,
    stepWorkspacePath: externalBag.stepWorkspacePath,
    stepConsoleAdapter: externalBag.stepConsoleAdapter,
    builderApiAdapter: externalBag.builderApiAdapter,
    isGrpSuccess: true
  };

  bag.stepConsoleAdapter.openCmd('Uploading archive for ' +
    (bag.stepData && bag.stepData.step && bag.stepData.step.name));
  bag.who = util.format('%s|step|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _getArtifactUrl.bind(null, bag),
      _uploadArtifacts.bind(null, bag)
    ],
    function (err) {
      if (bag.isGrpSuccess)
        bag.stepConsoleAdapter.closeCmd(true);
      else
        bag.stepConsoleAdapter.closeCmd(false);

      if (err)
        logger.error(bag.who, util.format('Failed to upload artifacts'));
      else
        logger.info(bag.who, 'Successfully uploaded artifacts');

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
    name: bag.stepData.step.name
  };

  bag.artifactName = util.format('%s.tar.gz', bag.step.id);

  return next(hasErrors);
}

function _getArtifactUrl(bag, next) {
  var who = bag.who + '|' + _getArtifactUrl.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.publishMsg('Getting upload URL');

  var query = 'artifactName=' + bag.artifactName;

  bag.builderApiAdapter.getStepArtifactUrls(bag.step.id, query,
    function (err, artifactUrls) {
      var msg;
      if (err) {
        msg = util.format('%s, Failed to get artifact URLs for ' +
          'stepId: %s', who, bag.step.id, err);

        bag.stepConsoleAdapter.publishMsg(msg);
        return next();
      }

      bag.artifactUrl = artifactUrls.put;
      msg = util.format(
        'Got artifact URL for stepId: %s ', bag.step.id);
      bag.stepConsoleAdapter.publishMsg(msg);
      return next();
    }
  );
}

function _uploadArtifacts(bag, next) {
  if (!bag.artifactUrl) return next();
  var who = bag.who + '|' + _uploadArtifacts.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.publishMsg('Uploading reports');

  var scriptBag = {
    artifactUrl: bag.artifactUrl,
    artifactName: bag.artifactName,
    stepWorkspacePath: bag.stepWorkspacePath,
    builderApiAdapter: bag.builderApiAdapter,
    stepConsoleAdapter: bag.stepConsoleAdapter
  };

  upload(scriptBag,
    function (err) {
      if (err) {
        bag.isGrpSuccess = false;
        logger.error(who,
          util.format('Failed to upload artifacts with error: %s', err)
        );
        return next(true);
      }
      logger.debug('Successfully uploaded artifacts');
      return next();
    }
  );
}
