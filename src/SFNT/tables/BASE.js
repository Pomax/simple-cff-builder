var utils = require("../../utils");
var struct = utils.struct;

"use strict";

var BASE = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

BASE.prototype = new struct("BASE table", [
  //...
]);

module.exports = BASE;
