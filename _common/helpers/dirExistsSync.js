'use strict';

var self = dirExistsSync;
module.exports = self;

var fs = require('fs-extra');

function dirExistsSync(dirPath) {
  try {
    var stat = fs.statSync(dirPath);
    return stat.isDirectory();
  } catch (e) {
    return false;
  }
}
