var utils = require("../../utils");
var struct = utils.struct;

"use strict";

var GDEF = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

GDEF.prototype = new struct("GDEF table", [
  //...
]);

module.exports = GDEF;
