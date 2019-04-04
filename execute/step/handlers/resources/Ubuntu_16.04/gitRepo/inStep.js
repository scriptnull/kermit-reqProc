'use strict';
var self = inStep;
module.exports = self;

var path = require('path');
var executeDependencyScript = require('../../../executeDependencyScript.js');

function inStep(params, callback) {
  var bag = {
    resBody: {},
    dependency: params.dependency,
    templatePath: path.resolve(__dirname, 'templates/inStep.sh'),
    stepInDir: params.rootDir,
    scriptName: 'inStep.sh',
    builderApiAdapter: params.builderApiAdapter,
    stepConsoleAdapter: params.stepConsoleAdapter
  };

  bag.who = util.format('%s|step|handlers|resources|gitRepo|%s',
    msName, self.name);
  logger.verbose(bag.who, 'Starting');

  bag.scriptPath =
    path.join(bag.stepInDir, 'resources', bag.dependency.name, bag.scriptName);

  async.series([
      _checkInputParams.bind(null, bag),
      _injectDependencies.bind(null, bag),
      _executeScript.bind(null, bag)
    ],
    function (err) {
      logger.verbose(bag.who, 'Completed');
      return callback(err, bag.resBody);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.debug(who, 'Inside');

  var consoleErrors = [];

  if (!bag.dependency.systemPropertyBag)
    consoleErrors.push(
      util.format('%s gitRepo %s is missing required repository information.',
        who, bag.dependency.name)
    );

  if (!bag.dependency.resourceConfigPropertyBag)
    consoleErrors.push(
      util.format('%s gitRepo %s is missing required resource information.',
        who, bag.dependency.name)
    );

  if (!bag.dependency.version ||
    _.isEmpty(bag.dependency.version.propertyBag) ||
    _.isEmpty(bag.dependency.version.propertyBag.shaData))
    consoleErrors.push(
      util.format('%s gitRepo %s version %s does not have shaData. ' +
        'Create a new version by webhook before using this resource. ',
        who, bag.dependency.name,
        bag.dependency.version && bag.dependency.version.id)
    );

  if (consoleErrors.length > 0) {
    _.each(consoleErrors,
      function (e) {
        var msg = e;
        logger.error(bag.who, e);
        bag.stepConsoleAdapter.publishMsg(msg);
      }
    );
    bag.stepConsoleAdapter.closeCmd(false);
    return next(true);
  }

  bag.stepConsoleAdapter.publishMsg('Successfully validated dependencies');
  return next();
}

function _injectDependencies(bag, next) {
  var who = bag.who + '|' + _injectDependencies.name;
  logger.debug(who, 'Inside');

  bag.dependency.noVerifySSL =
    !_.isUndefined(process.env.NODE_TLS_REJECT_UNAUTHORIZED);
  bag.dependency.privateKey =
    bag.dependency.systemPropertyBag.sysPrivateDeployKey;
  bag.dependency.isPrivate =
    bag.dependency.systemPropertyBag.isPrivateRepository;

  if (bag.dependency.isPrivate)
    bag.dependency.projectUrl =
      bag.dependency.systemPropertyBag.gitRepoRepositorySshUrl;
  else
    bag.dependency.projectUrl =
      bag.dependency.systemPropertyBag.gitRepoRepositoryHttpsUrl;

  var gitConfig = bag.dependency.resourceConfigPropertyBag.gitConfig;

  bag.dependency.gitConfig = [];

  if (!_.isEmpty(gitConfig)) {
    gitConfig = _.map(gitConfig,
      function (config) {
        if (_.isString(config) && config.indexOf('--global') ===  -1)
          config = util.format('--global %s', config);
        return config;
      }
    );
  }
  bag.dependency.gitConfig = gitConfig;
  bag.dependency.depth = bag.dependency.resourceConfigPropertyBag.shallowDepth;

  bag.dependency.cloneLocation = path.join(bag.stepInDir, 'resources',
    bag.dependency.name, bag.dependency.type);
  bag.dependency.keyLocation = path.join(bag.stepInDir, 'resources',
    bag.dependency.name, bag.dependency.name + '_key.pem');
  bag.dependency.commitSha = bag.dependency.version.propertyBag.sha;
  bag.dependency.shaData = bag.dependency.version.propertyBag.shaData;

  bag.stepConsoleAdapter.publishMsg('Successfully injected dependencies');
  return next();
}

function _executeScript(bag, next) {
  var who = bag.who + '|' + _executeScript.name;
  logger.debug(who, 'Inside');

  var scriptBag = {
    dependency: bag.dependency,
    templatePath: bag.templatePath,
    scriptPath: bag.scriptPath,
    parentGroupDescription: 'IN Git Repo',
    builderApiAdapter: bag.builderApiAdapter,
    stepConsoleAdapter: bag.stepConsoleAdapter
  };

  var provider = bag.dependency.systemPropertyBag.repositoryProvider;

  if (provider === 'github')
    scriptBag.templatePath =
      path.resolve(__dirname, 'templates/providers/_github.sh');
  else if (provider === 'bitbucket' || provider === 'bitbucketServer')
    scriptBag.templatePath =
      path.resolve(__dirname, 'templates/providers/_bitbucket.sh');
  else if (provider === 'gitlab')
    scriptBag.templatePath =
      path.resolve(__dirname, 'templates/providers/_gitlab.sh');
  else if (provider === 'gerrit')
    scriptBag.templatePath =
      path.resolve(__dirname, 'templates/providers/_gerrit.sh');

  executeDependencyScript(scriptBag,
    function (err) {
      if (err) {
        logger.error(who,
          util.format('Failed to execute script for dependency %s ' +
          'with error: %s', bag.dependency.name, err)
        );
        return next(true);
      }
      logger.debug(
        util.format('Successfully executed script for dependency %s',
          bag.dependency.name
        )
      );
      return next();
    }
  );
}
