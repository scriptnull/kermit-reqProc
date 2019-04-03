'use strict';

var self = fileExistsSync;
module.exports = self;

var fs = require('fs-extra');

function fileExistsSync(filePath) {
  try {
    var stat = fs.statSync(filePath);
    return stat.isFile();
  } catch (e) {
    return false;
  }
}
