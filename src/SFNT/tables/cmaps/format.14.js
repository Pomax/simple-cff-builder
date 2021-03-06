var struct = require("../../../utils").struct;

"use strict";

var format14 = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    input.format = 14;
    this.fill(input);
  }
};

format14.prototype = new struct("cmap format 14", [
	["format", "USHORT", "subtable format"]
]);

module.exports = format14;
