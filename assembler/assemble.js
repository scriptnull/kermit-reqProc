'use strict';

var self = assemble;
module.exports = self;

var _ = require('underscore');
var fs = require('fs');
var path = require('path');

// overriding the delimiters to %%context%%
_.templateSettings = _.extend(_.templateSettings,
  { interpolate: /\%\%([\s\S]+?)\%\%/g });

var isDirectory = require('../_common/helpers/isDirectory.js');
var isFile = require('../_common/helpers/isFile.js');

var assemblyOrder = ['onSuccess', 'onFailure', 'onComplete', 'output',
  'environmentVariables', 'image', 'auto', 'dependsOn', 'onStart', 'onExecute'];
var singleQuoteEscapeSections = ['onSuccess', 'onFailure', 'onComplete',
  'onStart', 'onExecute'];

function assemble(externalBag, callback) {
  var bag = {
    assembledScript: {},
    objectType: externalBag.objectType,
    objectSubType: externalBag.objectSubType,
    json: externalBag.json,
    execTemplatesRootDir: externalBag.execTemplatesRootDir,
    script: ''
  };

  bag.who = util.format('%s|assembler|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _assembleNativeScriptFragment.bind(null, bag),
      _combineNativeScriptFragment.bind(null, bag),
      _assembleScript.bind(null, bag),
      _combineScript.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, 'Failed to assemble script', err);
      else
        logger.info(bag.who, 'Successfully assembled script');

      var resultBag = {
        assembledScript: bag.script
      };

      return callback(err, resultBag);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'objectType',
    'objectSubType',
    'json',
    'execTemplatesRootDir'
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

function _assembleNativeScriptFragment(bag, next) {
  if (bag.objectType !== 'steps' || bag.objectSubType === 'bash') return next();

  var who = bag.who + '|' + _assembleNativeScriptFragment.name;
  logger.verbose(who, 'Inside');

  // execution is optional for native steps.
  // We add a placeholder to force the execution.onExecute template
  bag.json.execution = bag.json.execution || {};
  if (!_.has(bag.json.execution, 'onExecute'))
    bag.json.execution.onExecute = ['native'];

  var rootDirectoryPath = path.resolve(bag.execTemplatesRootDir, bag.objectType,
    bag.objectSubType);

  if (!isDirectory(rootDirectoryPath))
    return next(util.format('Root directory: %s is incorrect',
      rootDirectoryPath));

  __addTemplate(bag.objectSubType, rootDirectoryPath, bag.json, bag);

  return next();
}

function _combineNativeScriptFragment(bag, next) {
  if (bag.objectType !== 'steps' || bag.objectSubType === 'bash') return next();

  var who = bag.who + '|' + _combineNativeScriptFragment.name;
  logger.verbose(who, 'Inside');

  var fragment = '';

  _.each([ bag.objectSubType ].concat(assemblyOrder),
    function (component) {
      if (!_.isEmpty(bag.assembledScript[component]))
        fragment += (bag.assembledScript[component].header +
          bag.assembledScript[component].script +
          bag.assembledScript[component].footer);
    }
  );

  // And now we transform this into a bash step with a script fragment
  // for the onExecute section. This allows the next assemble/combine
  // functions to create a fully baked bash step for execution.
  bag.objectSubType = 'bash';
  bag.json.execution.onExecute = {
    isScriptFragment: true,
    scriptFragment: fragment
  };

  // Reset the assembledScript because we've taken what we need and put
  // it in the onExecute section
  bag.assembledScript = {};
  return next();
}

function _assembleScript(bag, next) {
  var who = bag.who + '|' + _assembleScript.name;
  logger.verbose(who, 'Inside');

  var rootDirectoryPath = path.resolve(bag.execTemplatesRootDir, bag.objectType,
    bag.objectSubType);

  if (!isDirectory(rootDirectoryPath))
    return next(util.format('Root directory: %s is incorrect',
      rootDirectoryPath));

  __addTemplate(bag.objectSubType, rootDirectoryPath, bag.json, bag);
  return next();
}

function _combineScript(bag, next) {
  var who = bag.who + '|' + _combineScript.name;
  logger.verbose(who, 'Inside');

  _.each([ bag.objectSubType ].concat(assemblyOrder),
    function (component) {
      if (!_.isEmpty(bag.assembledScript[component]))
        bag.script += (bag.assembledScript[component].header +
          bag.assembledScript[component].script +
          bag.assembledScript[component].footer);
    }
  );
  return next();
}

// parentDirectoryName: parent directory of the directory being operated on
// currentDirectoryPath: directory path of the directory opreated on
// context: context pertaining to current directory
// bag: pass by reference to assemble the script
function __addTemplate(parentDirectoryName, currentDirectoryPath, context,
  bag) {
  var directoryContents = fs.readdirSync(currentDirectoryPath);
  directoryContents.sort(
    function (a, b) {
      if (a === b) return 0;
      if (a === 'header.sh') return -1;
      if (b === 'header.sh') return 1;
      if (a === 'footer.sh') return 1;
      if (b === 'footer.sh') return -1;
      if (a < b) return -1;
      return 1;
    }
  );
  _.each(directoryContents,
    function (contentName) {
      var santizedContentName = contentName;
      if (santizedContentName.indexOf('_') > -1)
        santizedContentName = santizedContentName.split('_')[1];
      if (isDirectory(path.join(currentDirectoryPath, contentName))) {
        if (__contentExistsInCurrentContextObject(context,
          santizedContentName))
          __addTemplate(santizedContentName,
            path.join(currentDirectoryPath, contentName),
            context[santizedContentName], bag);
      } else if (isFile(path.join(currentDirectoryPath, contentName))) {
        var script = '';

        if (!bag.assembledScript[parentDirectoryName])
          bag.assembledScript[parentDirectoryName] = {};
        if (_.isEmpty(bag.assembledScript[parentDirectoryName].script))
          bag.assembledScript[parentDirectoryName].script = '';
        if (_.isEmpty(bag.assembledScript[parentDirectoryName].header))
          bag.assembledScript[parentDirectoryName].header = '';
        if (_.isEmpty(bag.assembledScript[parentDirectoryName].footer))
          bag.assembledScript[parentDirectoryName].footer = '';

        if (contentName === parentDirectoryName + '.sh' ||
          contentName === context + '.sh') {
          var templateScript = fs.readFileSync(path.join(currentDirectoryPath,
            contentName), 'utf8').toString();
          var template = _.template(templateScript);
          if (_.isString(context)) {
            script = template({ 'context': context });
          } else if (_.isArray(context)) {
            _.each(context,
              function (element) {
                if (_.isString(element)) {
                  if (_.contains(singleQuoteEscapeSections,
                    parentDirectoryName) ||
                    _.contains(singleQuoteEscapeSections, contentName))
                    element = __escapeString(element);
                  script += template({ 'context': element });
                } else if (_.isObject(element)) {
                  script += template({ 'context': element });
                }
              }
            );
          } else if (_.isObject(context)) {
            if (context.isScriptFragment === true) {
              script = context.scriptFragment;
            } else {
              script = template({ 'context': context });
            }
          }

          bag.assembledScript[parentDirectoryName].script += script;
        } else if (contentName === 'header.sh') {
          bag.assembledScript[parentDirectoryName].header =
            fs.readFileSync(path.join(currentDirectoryPath, contentName),
              'utf8').toString();
        } else if (contentName === 'footer.sh') {
          bag.assembledScript[parentDirectoryName].footer =
            fs.readFileSync(path.join(currentDirectoryPath, contentName),
              'utf8').toString();
        }
      }
    }
  );
}

function __contentExistsInCurrentContextObject(context, content) {
  return !_.isEmpty(context[content]);
}

function __escapeString(string) {
  string = string.replace(/\\/g, '\\\\');
  string = string.replace(/'/g, "\\'");
  return string;
}
