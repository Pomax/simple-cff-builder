var struct = require("../../../../utils").struct;

"use strict";

var Segment = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

Segment.prototype = new struct("Segment", [
	  ["end",     "USHORT", "end code for this segment"]
	, ["start",   "USHORT", "start code for this segment"]
	, ["delta",   "SHORT",  "delta to ensure continuous sequence wrt previous segments"]
	, ["offset",  "USHORT", "Offsets into glyphIdArray"]
	, ["glyphId", "USHORT", "Glyph index"]
]);

module.exports = Segment;
