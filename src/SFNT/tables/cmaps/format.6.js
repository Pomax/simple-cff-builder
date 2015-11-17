var struct = require("../../../utils").struct;

"use strict";

var format6 = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    input.format = 6;
    this.fill(input);
  }
};

format6.prototype = new struct("cmap format 6", [
  ["format", "USHORT", "subtable format"]
]);

module.exports = format6;
