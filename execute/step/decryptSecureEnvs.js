'use strict';

var self = decryptSecureEnvs;
module.exports = self;

function decryptSecureEnvs(externalBag, callback) {
  var bag = {
    builderApiAdapter: externalBag.builderApiAdapter,
    stepData: externalBag.stepData,
    stepConsoleAdapter: externalBag.stepConsoleAdapter,
    projectId: externalBag.projectId,
    errorEnvs: []
  };
  bag.who = util.format('%s|step|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _decryptSecureEnvs.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to decrypt secure envs'));
      else
        logger.info(bag.who, util.format('Successfully decrypted secure envs'));

      var result = {
        stepData: bag.stepData
      };
      return callback(err, result);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'projectId',
    'stepData',
    'stepConsoleAdapter',
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

function _decryptSecureEnvs(bag, next) {
  var who = bag.who + '|' + _decryptSecureEnvs.name;
  logger.verbose(who, 'Inside');

  var error = false;
  bag.stepConsoleAdapter.openCmd('Decrypting secure envs');

  async.eachOfLimit(bag.stepData.step.setup.environmentVariables, 10,
    function (envObject, index, nextEnvObject) {
      if (!envObject.isSecure) return nextEnvObject();

      var body = {
        'encryptedText': envObject.value
      };

      bag.builderApiAdapter.decryptByProjectId(bag.projectId, body,
        function (err, result) {
          if (err) {
            var msg = util.format('%s, decryptByProjectId for key %s ' +
              'failed with error: %s', bag.who, envObject.key, err);
            logger.warn(msg);
            bag.stepConsoleAdapter.publishMsg(msg);
            error = true;
          } else {
            bag.stepData.step.setup.environmentVariables[index].value =
              result.clearText;
            bag.stepConsoleAdapter.publishMsg(
              util.format('Successfully decrypted value env: %s',
                envObject.key)
            );
          }

          return nextEnvObject();
        }
      );
    }, function () {
      bag.stepConsoleAdapter.closeCmd(!error);
      return next(error);
    }
  );
}
