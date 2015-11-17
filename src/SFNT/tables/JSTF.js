var utils = require("../../utils");
var struct = utils.struct;

"use strict";

var JSTF = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

JSTF.prototype = new struct("JSTF table", [
  //...
]);

module.exports = JSTF;
