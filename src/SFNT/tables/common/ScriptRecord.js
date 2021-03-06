var utils = require("../../../utils");
var struct = utils.struct;

"use strict";

var ScriptRecord = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    input.ScriptTag = input.ScriptTag || "DFLT";
    this.fill(input);
  }
};

ScriptRecord.prototype = new struct("ScriptRecord", [
    ["ScriptTag", "CHARARRAY", "script name ('DFLT' for the default script)"]
  , ["Offset",    "OFFSET",    "Offset to the associated ScriptTable (offset from the start of the ScriptList)"]
]);

module.exports = ScriptRecord;
