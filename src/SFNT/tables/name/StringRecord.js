var utils = require("../../../utils");
var struct = utils.struct;
var atou = utils.atou;

"use strict";

/**
 * Name record constructor
 */
var StringRecord = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

/**
 * Name table definition
 */
StringRecord.prototype = new struct("StringRecord", [
  ["string", "CHARARRAY", "The string to be encoded"]
]);

module.exports = StringRecord;
