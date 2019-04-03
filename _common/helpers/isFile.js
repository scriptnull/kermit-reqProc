'use strict';

var self = isFile;
module.exports = self;

var fs = require('fs-extra');

function isFile(filePath) {
  try {
    var stat = fs.statSync(filePath);
    return stat.isFile();
  } catch (e) {
    return false;
  }
}
