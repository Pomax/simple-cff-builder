var struct = require("../../../utils").struct;

"use strict";

var EncodingRecord = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

EncodingRecord.prototype = new struct("EncodingRecord", [
   ["platformID", "USHORT", "Platform ID"]
 , ["encodingID", "USHORT", "Platform-specific encoding ID"]
 , ["offset",     "ULONG",  "Byte offset from beginning of table to the subtable for this encoding"]
]);

module.exports = EncodingRecord;
