var utils = require("../../../../utils");
var dataBuilding = utils.dataBuilding;
var Segment = require("./Segment");

"use strict";
var encoder = dataBuilding.encoder;
var terminator = encoder.USHORT(0xFFFF);

var Segments = function() {
	this.data = [];
};

Segments.prototype = {
  addSegment: function(code) {
    var idx = this.data.length + 1;
    this.data.push(new Segment({
      end: code,
      start: code,
      delta: -(code - idx),
      offset: 0,
      glyphId: idx
    }));
  },
  finalise: function() {
    var terminator = new Segment({
      end: 0xFFFF,
      start: 0xFFFF,
      delta: 1,
      offset: 0
    });
    terminator.unset(["glyphId"]);
    this.data.push(terminator);
  }
};

module.exports = Segments;
