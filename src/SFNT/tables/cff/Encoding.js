var utils = require("../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;

"use strict";

// FIXME: technically this is only the format1 Encoding object

var Encoding = function(input) {
  var codes = [];
  if(!this.parse(input)) {
    input = input || {};
    input.format = 0;
    var codes = input.letters.map(function(v,idx) {
      return idx+1;
    });
    input.nCodes = codes.length;
    input.codes = codes;
    this.fill(input);
    this.setName("Encoding");
  }
};

Encoding.prototype = new struct("CFF Encoding", [
    ["format", "BYTE",    "encoding format"]
  , ["nCodes", "BYTE",    "..."]
  , ["codes",  "LITERAL", ""]
]);

module.exports = Encoding;
