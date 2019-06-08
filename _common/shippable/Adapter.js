'use strict';
var self = ShippableAdapter;
module.exports = self;
var request = require('request');

function ShippableAdapter(token) {
  logger.verbose(util.format('Initializing %s', self.name));
  this.token = token;
  this.baseUrl = config.apiUrl;
  this.headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Authorization': 'apiToken '.concat(token)
  };
}

//#######################   GET  by alphabetical order  ########################
/*
 ------------------------
 Standards:
 ------------------------
 * The parameters for this.method() in getSById should occupy
 a line of their own.

 * We're no longer using `var url`

 * `util.format` needs to be used for all routes that use an Id.

 ------------------------
 Formats:
 ------------------------

 ShippableAdapter.prototype.getSById =
 function (sId, callback) {
 this.get(
 util.format('/S/%s', sId),
 callback
 );
 };

 ShippableAdapter.prototype.getS =
 function (callback) {
 this.get('/S', callback);
 };

 ShippableAdapter.prototype.getSByParentId =
 function (parentId, callback) {
 this.get(
 util.format('/parent/%s/S', parentId),
 callback
 );
 };

 */

ShippableAdapter.prototype.postClusterNodeStats =
  function (json, callback) {
    this.post(
      util.format('/clusterNodeStats'),
      json,
      callback
    );
  };

//identities
ShippableAdapter.prototype.getIdentities =
  function (query, callback) {
    this.get(
      util.format('/identities?%s', query),
      callback
    );
  };

// integrations

ShippableAdapter.prototype.getProjectIntegrations =
  function (query, callback) {
    this.get(
      util.format('/projectIntegrations?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getPipelineById =
  function (id, callback) {
    this.get(
      util.format('/pipelines/%s', id),
      callback
    );
  };

ShippableAdapter.prototype.getPipelineArtifactUrls =
  function (pipelineId, query, callback) {
    this.get(
      util.format('/pipelines/%s/artifactUrl?%s', pipelineId, query),
      callback
    );
  };

ShippableAdapter.prototype.getLatestPipelineState =
  function (pipelineId, callback) {
    this.get(
      util.format('/pipelines/%s/latestState', pipelineId),
      callback
    );
  };

ShippableAdapter.prototype.getProjectById =
  function (id, callback) {
    this.get(
      util.format('/projects/%s', id),
      callback
    );
  };

ShippableAdapter.prototype.getProviderById =
  function (id, callback) {
    this.get(
      util.format('/providers/%s', id),
      callback
    );
  };

ShippableAdapter.prototype.getProviders =
  function (query, callback) {
    this.get(
      util.format('/providers?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getResources =
  function (query, callback) {
    this.get(
      util.format('/resources?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getResourceById =
  function (resourceId, callback) {
    this.get(
      util.format('/resources/%s', resourceId),
      callback
    );
  };

ShippableAdapter.prototype.getResourceVersionById =
  function (resourceVersionId, callback) {
    this.get(
      util.format('/resourceVersions/%s', resourceVersionId),
      callback
    );
  };

ShippableAdapter.prototype.getNextSteps =
  function (runId, json, callback) {
    this.post(
      util.format('/runs/%s/nextSteps', runId),
      json,
      callback
    );
  };

ShippableAdapter.prototype.getRunById =
  function (runId, callback) {
    this.get(
      util.format('/runs/%s', runId),
      callback
    );
  };

ShippableAdapter.prototype.getRunArtifactUrls =
  function (runId, query, callback) {
    this.get(
      util.format('/runs/%s/artifactUrl?%s', runId, query),
      callback
    );
  };

// runResourceVersions
ShippableAdapter.prototype.getRunResourceVersions =
  function (query, callback) {
    this.get(
      util.format('/runResourceVersions?%s', query),
      callback
    );
  };

// runStepConnections
ShippableAdapter.prototype.getRunStepConnections =
  function (query, callback) {
    this.get(
      util.format('/runStepConnections?%s', query),
      callback
    );
  };

// steps
ShippableAdapter.prototype.getStepById =
  function (id, callback) {
    this.get(
      util.format('/steps/%s', id),
      callback
    );
  };

ShippableAdapter.prototype.getSteps =
  function (query, callback) {
    this.get(
      util.format('/steps?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getStepArtifactUrls =
  function (stepId, query, callback) {
    this.get(
      util.format('/steps/%s/artifactUrl?%s', stepId, query),
      callback
    );
  };

ShippableAdapter.prototype.getLatestArtifactUrlForStepName =
  function (projectId, stepName, callback) {
    this.get(
      util.format('/projects/%s/%s/latestArchive', projectId, stepName),
      callback
    );
  };

// steplets
ShippableAdapter.prototype.getSteplets =
  function (query, callback) {
    this.get(
      util.format('/steplets?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.postStepTestReports =
  function (json, callback) {
    this.post(
      util.format('/stepTestReports'),
      json,
      callback
    );
  };

ShippableAdapter.prototype.validateSystemNodeById =
  function (systemNodeId, callback) {
    this.get(
      util.format('/systemNodes/%s/validate', systemNodeId),
      callback
    );
  };

ShippableAdapter.prototype.getSystemCodes =
  function (query, callback) {
    this.get(
      '/systemCodes?' + query,
      callback
    );
  };

ShippableAdapter.prototype.getSystemSettings =
  function (callback) {
    this.get(
      '/systemSettings',
      callback
    );
  };


//#######################  DELETE  by alphabetical order  ######################

//#######################  POST  by alphabetical order  ########################

ShippableAdapter.prototype.postResourceVersion =
  function (json, callback) {
    this.post(
      util.format('/resourceVersions'),
      json,
      callback
    );
  };

ShippableAdapter.prototype.postSystemNodeStats =
  function (json, callback) {
    this.post(
      util.format('/systemNodeStats'),
      json,
      callback
    );
  };

ShippableAdapter.prototype.postStepConsoles =
  function (json, callback) {
    this.post(
      '/stepConsoles',
      json,
      callback
    );
  };

//#######################  PUT  by alphabetical order  ########################

ShippableAdapter.prototype.putClusterNodeById =
  function (clusterNodeId, clusterNode, callback) {
    this.put(
      util.format('/clusterNodes/%s', clusterNodeId),
      clusterNode,
      callback
    );
  };

// steps
ShippableAdapter.prototype.putStepById =
  function (id, json, callback) {
    this.put(
      util.format('/steps/%s', id),
      json,
      callback
    );
  };
ShippableAdapter.prototype.putStepletById =
  function (id, json, callback) {
    this.put(
      util.format('/steplets/%s', id),
      json,
      callback
    );
  };

ShippableAdapter.prototype.putSystemNodeById =
  function (id, json, callback) {
    this.put(
      util.format('/systemNodes/%s', id),
      json,
      callback
    );
  };

ShippableAdapter.prototype.validateClusterNodeById =
  function (clusterNodeId, callback) {
    this.get(
      util.format('/clusterNodes/%s/validate', clusterNodeId),
      callback
    );
  };

ShippableAdapter.prototype.get =
  function (relativeUrl, callback) {
    var bag = {};
    bag.opts = {
      method: 'GET',
      url: this.baseUrl.concat(relativeUrl),
      headers: this.headers
    };
    bag.who = util.format('%s call to %s', bag.opts.method, bag.opts.url);
    logger.debug(util.format('Starting %s', bag.who));

    async.series([
        _performCall.bind(null, bag),
        _parseBody.bind(null, bag)
      ],
      function () {
        callback(bag.err, bag.parsedBody, bag.res);
      }
    );
  };

ShippableAdapter.prototype.post =
  function (relativeUrl, json, callback) {
    var bag = {};
    bag.opts = {
      method: 'POST',
      url: this.baseUrl.concat(relativeUrl),
      headers: this.headers,
      json: json
    };
    bag.who = util.format('%s call to %s', bag.opts.method, bag.opts.url);
    logger.debug(util.format('Starting %s', bag.who));

    async.series([
        _performCall.bind(null, bag),
        _parseBody.bind(null, bag)
      ],
      function () {
        callback(bag.err, bag.parsedBody, bag.res);
      }
    );
  };

ShippableAdapter.prototype.put =
  function (relativeUrl, json, callback) {
    var bag = {};
    bag.opts = {
      method: 'PUT',
      url: this.baseUrl.concat(relativeUrl),
      headers: this.headers,
      json: json
    };
    bag.who = util.format('%s call to %s', bag.opts.method, bag.opts.url);
    logger.debug(util.format('Starting %s', bag.who));

    async.series([
        _performCall.bind(null, bag),
        _parseBody.bind(null, bag)
      ],
      function () {
        callback(bag.err, bag.parsedBody, bag.res);
      }
    );
  };

ShippableAdapter.prototype.delete =
  function (relativeUrl, callback) {
    var bag = {};
    bag.opts = {
      method: 'DELETE',
      url: this.baseUrl.concat(relativeUrl),
      headers: this.headers
    };
    bag.who = util.format('%s call to %s', bag.opts.method, bag.opts.url);
    logger.debug(util.format('Starting %s', bag.who));

    async.series([
        _performCall.bind(null, bag),
        _parseBody.bind(null, bag)
      ],
      function () {
        callback(bag.err, bag.parsedBody, bag.res);
      }
    );
  };

function _performCall(bag, next) {
  var who = bag.who + '|' + _performCall.name;
  logger.debug(who, 'Inside');

  bag.startedAt = Date.now();
  bag.timeoutLength = 1;
  bag.timeoutLimit = 180;

  __attempt(bag, next);

  function __attempt(bag, callback) {
    request(bag.opts,
      function (err, res, body) {
        var interval = Date.now() - bag.startedAt;
        var connectionError = false;

        if (res)
          logger.debug(
            util.format('%s took %s & returned status %s', bag.who, interval,
              res.statusCode)
          );
        else
          connectionError = true;

        if (res && res.statusCode > 299)
          err = err || res.statusCode;

        if ((res && res.statusCode > 299) || err) {
          if ((res && res.statusCode >= 500) || connectionError) {
            logger.error(
              util.format('%s returned error. Retrying in %s seconds',
                bag.who, bag.timeoutLength*2)
            );
            bag.timeoutLength *= 2;
            if (bag.timeoutLength > bag.timeoutLimit)
              bag.timeoutLength = 1;

            setTimeout(function () {
              __attempt(bag, callback);
            }, bag.timeoutLength * 1000);

            return;
          } else {
            logger.warn(util.format('%s returned status %s with error %s',
              bag.who, res && res.statusCode, err));
            bag.err = err;
          }
        }
        bag.res = res;
        bag.body = body;
        callback();
      }
    );
  }
}

function _parseBody(bag, next) {
  var who = bag.who + '|' + _parseBody.name;
  logger.debug(who, 'Inside');

  if (bag.body) {
    if (typeof bag.body === 'object') {
      bag.parsedBody = bag.body;
    } else {
      try {
        bag.parsedBody = JSON.parse(bag.body);
      } catch (e) {
        logger.error('Unable to parse bag.body', bag.body, e);
        bag.err = e;
      }
    }
  }
  return next();
}
