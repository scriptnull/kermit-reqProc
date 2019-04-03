'use strict';

var self = isDirectory;
module.exports = self;

var fs = require('fs-extra');

function isDirectory(dirPath) {
  try {
    var stat = fs.statSync(dirPath);
    return stat.isDirectory();
  } catch (e) {
    return false;
  }
}
