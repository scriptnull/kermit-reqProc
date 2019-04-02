'use strict';

var self = getValuesFromIntegrationJson;
module.exports = self;

var _ = require('underscore');

function getValuesFromIntegrationJson(formJSONValues) {
  var who = util.format('%s|common|helpers|%s', msName, self.name);
  logger.verbose(who, 'Starting');

  var result = {};

  _.each(formJSONValues,
    function (jsonValue) {
      if(jsonValue.label)
        result[jsonValue.label] = jsonValue.value;
    }
  );

  return result;
}
