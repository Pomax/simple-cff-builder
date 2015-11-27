var utils = require("../../utils");
var struct = utils.struct;
var LongHorMetric = require("./hmtx/LongHorMetric");

"use strict";

var hmtx = function(input, numberOfHMetrics) {
  if(!this.parse(input)) {
    this.fill({});
    this.build(input, numberOfHMetrics);
  }
};

hmtx.prototype = new struct("hmtx table", [
  ["hMetrics", "LITERAL", "the array of horizontal metrics for the glyphs in this font"]
]);

hmtx.prototype.createMetric = function(advanceWidth, lsb) {
  return new LongHorMetric({ advanceWidth: advanceWidth , lsb: lsb });
};

hmtx.prototype.build = function(globals, numberOfHMetrics) {
  var data = []
  var advanceWidth = (globals.xMax - globals.xMin);
  var lsb = globals.xMin;
  // FIXME: retrieve these valkues by examining globals.charstrings
  for(var i=0; i < numberOfHMetrics - 1; i++) {
    data.push(this.createMetric(advanceWidth, lsb));
  }
  data.push(this.createMetric(advanceWidth, lsb));
  this.hMetrics = data;
};

module.exports = hmtx;
