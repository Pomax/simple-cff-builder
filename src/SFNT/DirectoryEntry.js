var struct = require("../utils").struct;

"use strict";

var DirectoryEntry = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

DirectoryEntry.prototype = new struct("DirectoryEntry", [
    ["tag",      "CHARARRAY", "4-byte identifier"]
  , ["checkSum", "ULONG", "sum-as-ULONGs for this table"]
  , ["offset",   "ULONG", "offset to this table from the beginning of the file"]
  , ["length",   "ULONG", "length of the table (without padding) in bytes"]
]);

module.exports = DirectoryEntry;
