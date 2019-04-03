'use strict';

var self = postVersion;
module.exports = self;

var fs = require('fs-extra');
var path = require('path');

function postVersion(externalBag, callback) {
  var bag = {
    stepData: externalBag.stepData,
    stepConsoleAdapter: externalBag.stepConsoleAdapter,
    stepOutDir: externalBag.stepOutDir,
    builderApiAdapter: externalBag.builderApiAdapter
  };
  bag.who = util.format('%s|step|%s', msName, self.name);
  logger.info(bag.who, 'Inside');
  async.series([
      _checkInputParams.bind(null, bag),
      _postOutResourceVersions.bind(null, bag)
    ],
    function (err) {
      if (err) {
        logger.error(bag.who, util.format('Failed to post version'));
      } else{
        logger.info(bag.who, 'Successfully created version');
      }
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
    'stepOutDir',
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

function _postOutResourceVersions(bag, next) {
  var who = bag.who + '|' + _postOutResourceVersions.name;
  logger.verbose(who, 'Inside');

  async.eachSeries(bag.stepData.resources,
    function (resource, nextResource) {
      var outDependency = {};
      if (resource.operation === 'OUT') {
        outDependency.name = resource.name;
        outDependency.id = resource.id;
        outDependency.version = resource.version;
        outDependency.projectId = resource.projectId;
      }

      if (!outDependency) {
        return nextResource();
      }

      var innerBag = {
        who: bag.who,
        stepConsoleAdapter: bag.stepConsoleAdapter,
        stepOutDir: bag.stepOutDir,
        builderApiAdapter: bag.builderApiAdapter,
        dependency: outDependency,
        versionJson: null,
        hasEnv: true,
        isChanged: false,
        isGrpSuccess: true
      };

      bag.stepConsoleAdapter.openCmd('Processing version for ' +
        innerBag.dependency.name);
      async.series([
          __readVersionEnv.bind(null, innerBag),
          __compareVersions.bind(null, innerBag),
          __postResourceVersion.bind(null, innerBag)
        ],
        function (err) {
          if (innerBag.isGrpSuccess) {
            bag.stepConsoleAdapter.closeCmd(true);
          } else {
            bag.stepConsoleAdapter.closeCmd(false);
          }

          return nextResource(err);
        }
      );
    },
    function (err) {
      return next(err);
    }
  );
}

function __readVersionEnv(bag, next) {
  var who = bag.who + '|' + __readVersionEnv.name;
  logger.debug(who, 'Inside');

  bag.stepConsoleAdapter.publishMsg('Reading resource env file');

  var envFilePath = path.join(bag.stepOutDir, 'resources', util.format('%s.env',
    bag.dependency.name));
  try {
    var envFile = fs.readFileSync(envFilePath).toString();
    // Remove BOM characters which get added in case of Windows
    // Refer https://github.com/nodejs/node-v0.x-archive/issues/1918
    envFile = envFile.replace(/^\uFEFF/, '');
    var lines = envFile.split('\n');

    _.each(lines,
      function (line) {
        var nameAndValue = line.split('=');
        var key = nameAndValue[0];
        var value = nameAndValue[1];
        if (key) {
          bag.stepConsoleAdapter.publishMsg('found a key: ' + key);
          bag.versionJson[key] = value;
        }
      }
    );
  } catch (err) {
    bag.stepConsoleAdapter.publishMsg(
      util.format('Could not parse file %s. Hence Skipping.',
        envFilePath));
    bag.stepConsoleAdapter.publishMsg(
      util.format('unable to read file %s.env', bag.dependency.name));
    bag.stepConsoleAdapter.closeCmd(false);
    bag.hasEnv = false;
  }
  bag.stepConsoleAdapter.publishMsg('Successfully parsed .env file.');

  return next();
}

function __compareVersions(bag, next) {
  var who = bag.who + '|' + __compareVersions.name;
  logger.debug(who, 'Inside');

  bag.stepConsoleAdapter.publishMsg('Comparing current version to original');
  var originalVersion = bag.dependency.version;

  if (!_.isEqual(originalVersion.propertyBag,
    bag.versionJson)) {
    bag.isChanged = true;
    bag.stepConsoleAdapter.publishMsg('version has changed');
  }

  if (!bag.isChanged)
    bag.stepConsoleAdapter.publishMsg('version has NOT changed');
  return next();
}

function __postResourceVersion(bag, next) {
  if (!bag.isChanged) return next();

  var who = bag.who + '|' + __postResourceVersion.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.publishMsg('Posting new version');
  var newResourceVersion = {
    resourceId: bag.dependency.id,
    contentPopertyBag: bag.versionJson,
    projectId: bag.dependency.projectId
  };

  bag.builderApiAdapter.postResourceVersion(newResourceVersion,
    function (err, version) {
      var msg;
      if (err) {
        msg = util.format('%s, Failed to post resource version for ' +
          'resourceId: %s', who, bag.dependency.id, err);
        bag.stepConsoleAdapter.publishMsg(msg);
        bag.stepConsoleAdapter.closeCmd(false);
        bag.isGrpSuccess = false;
        return next(true);
      }

      bag.outVersion = version;
      msg = util.format('Post new resource version for resourceId: %s ' +
        'succeeded with version %s', version.resourceId,
        util.inspect(version.versionNumber)
      );
      bag.stepConsoleAdapter.publishMsg(msg);
      return next();
    }
  );
}
